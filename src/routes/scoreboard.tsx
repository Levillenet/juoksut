import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, Maximize2 } from "lucide-react";
import {
  NewResultOverlay,
  type NewResultItem,
} from "@/components/announcer/NewResultOverlay";

import {
  competitionScheduleQueryOptions,
  eventDetailsQueryOptions,
} from "@/lib/tuloslista-queries";
import {
  formatTime,
  helsinkiDateKey,
  isRunningEvent,
  STATUS_LABEL,
  type Allocation,
  type Round,
} from "@/lib/tuloslista";
import { useCompetitionId } from "@/lib/competition-store";
import { Button } from "@/components/ui/button";
import { RequireRole } from "@/components/RequireRole";
import { effectiveRecord } from "@/lib/record-baseline";
import { loadHistoryBaselineForCompetition } from "@/lib/history-baseline";
import { athleteKey } from "@/lib/athlete-key";
import { detectRecord, RecordStar } from "@/lib/records";
import { WakeLockToggle } from "@/components/WakeLockToggle";
import { getResultVisualState } from "@/lib/result-visualization";

type TopSize = 3 | 5 | 10;

type HeatSel = "all" | number;

interface SearchParams {
  eventId?: number;
  roundId?: number;
  top: TopSize;
  heat: HeatSel;
}

function parseTop(v: unknown): TopSize {
  if (v === 3 || v === "3") return 3;
  if (v === 5 || v === "5") return 5;
  return 10;
}

function parseHeat(v: unknown): HeatSel {
  if (v == null || v === "all") return "all";
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : "all";
}

export const Route = createFileRoute("/scoreboard")({
  head: () => ({
    meta: [
      { title: "Suorituspaikan livenäyttö – Lahden Ahkera" },
      {
        name: "description",
        content:
          "Iso live-näyttö kenttälajien suorituspaikalle: kärki, yritykset ja sijoitukset.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    eventId: typeof s.eventId === "number" ? s.eventId : s.eventId ? Number(s.eventId) : undefined,
    roundId: typeof s.roundId === "number" ? s.roundId : s.roundId ? Number(s.roundId) : undefined,
    top: parseTop(s.top),
    heat: parseHeat(s.heat),
  }),
  component: () => (
    <RequireRole allow={["official", "user"]}>
      <ScoreboardGate />
    </RequireRole>
  ),
});

function ScoreboardGate() {
  const { eventId } = Route.useSearch();
  return eventId ? <ScoreboardLive /> : <ScoreboardPicker />;
}

/* ---------------- Picker ---------------- */

function ScoreboardPicker() {
  const [competitionId] = useCompetitionId();
  const { top } = Route.useSearch();
  const navigate = useNavigate({ from: "/scoreboard" });
  const scheduleQ = useQuery(competitionScheduleQueryOptions(competitionId));

  const trackedRef = useRef<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!competitionId) return;
    if (trackedRef.current === competitionId) return;
    trackedRef.current = competitionId;
    trackEvent("scoreboard_view", {
      metadata: {
        competition_id: competitionId,
        competition_name: scheduleQ.data?.name ?? null,
      },
    });
  }, [competitionId, scheduleQ.data?.name]);

  const fieldByDate = useMemo(() => {
    const rounds = scheduleQ.data?.rounds ?? {};
    const out: Record<string, Round[]> = {};
    for (const [date, rs] of Object.entries(rounds)) {
      const fields = rs
        .filter((r) => !isRunningEvent(r))
        .sort((a, b) => a.BeginDateTimeWithTZ.localeCompare(b.BeginDateTimeWithTZ));
      if (fields.length) out[date] = fields;
    }
    return out;
  }, [scheduleQ.data]);

  const dates = useMemo(() => {
    return Object.keys(fieldByDate).sort((a, b) => {
      const [da, ma, ya] = a.split(".").map(Number);
      const [db, mb, yb] = b.split(".").map(Number);
      return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
    });
  }, [fieldByDate]);

  const todayKey = helsinkiDateKey(new Date().toISOString());

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Takaisin">
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">
              Suorituspaikan livenäyttö
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {scheduleQ.data?.name ?? `Kisa #${competitionId}`}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <section className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Kuinka monta kärkitulosta näytetään?
          </p>
          <div className="flex flex-wrap gap-2">
            {([3, 5, 10] as TopSize[]).map((n) => (
              <button
                key={String(n)}
                onClick={() => navigate({ search: (prev: SearchParams) => ({ ...prev, top: n }) })}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  top === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-secondary"
                }`}
              >
                {`Top ${n}`}
              </button>
            ))}
          </div>
        </section>

        <p className="mb-3 text-xs text-muted-foreground">
          Valitse kenttälaji, jolle livenäyttö avataan. Valinta avautuu koko ruudulle.
        </p>

        {scheduleQ.isLoading && (
          <div className="py-12 text-center text-sm text-muted-foreground">Ladataan…</div>
        )}

        {scheduleQ.data && dates.length === 0 && (
          <div className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Kisassa ei ole kenttälajeja.
          </div>
        )}

        {dates.map((date) => (
          <section key={date} className="mb-6">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {date}
              {date === todayKey && (
                <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Tänään
                </span>
              )}
            </h2>
            <ul className="space-y-2">
              {fieldByDate[date].map((r) => (
                <li key={r.Id}>
                  <Link
                    to="/scoreboard"
                    search={{ eventId: r.EventId, roundId: r.Id, top }}
                    className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm hover:bg-secondary"
                  >
                    <div className="w-16 shrink-0 text-lg font-bold tabular-nums">
                      {formatTime(r.BeginDateTimeWithTZ)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold leading-tight">
                        {r.EventName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{r.Name}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                      {STATUS_LABEL[r.Status]}
                    </span>
                    <Maximize2 className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}

/* ---------------- Live scoreboard ---------------- */

interface RankedRow extends Allocation {
  attempts: (string | null)[];
  best: string | null;
  bestIdx: number | null;
}

function ScoreboardLive() {
  const { eventId, roundId, top } = Route.useSearch();
  const [competitionId] = useCompetitionId();
  const navigate = useNavigate({ from: "/scoreboard" });
  const detailQ = useQuery(eventDetailsQueryOptions(competitionId, eventId!));
  const ev = detailQ.data ?? null;

  useEffect(() => {
    if (!competitionId) return;
    void loadHistoryBaselineForCompetition(competitionId);
  }, [competitionId]);

  const round = useMemo(
    () => ev?.Rounds.find((r) => r.Id === roundId) ?? ev?.Rounds[0],
    [ev, roundId],
  );

  const rows = useMemo<RankedRow[]>(() => {
    if (!round) return [];
    const allocs = round.Heats.flatMap((h) => h.Allocations);
    const enriched: RankedRow[] = allocs.map((a) => {
      const raw = a.Attempts ?? [];
      const attempts: (string | null)[] = Array.from({ length: 6 }, (_, i) => {
        const v = raw[i]?.Line1;
        return v && v.trim() ? v.trim() : null;
      });
      // best: prefer numeric Result, else best non-foul attempt
      let best: string | null = a.Result ?? null;
      let bestIdx: number | null = null;
      const numericAttempts = attempts.map((s) => {
        if (!s) return null;
        const n = parseFloat(s.replace(",", "."));
        return Number.isFinite(n) ? n : null;
      });
      let max = -Infinity;
      numericAttempts.forEach((n, i) => {
        if (n != null && n > max) {
          max = n;
          bestIdx = i;
          best = attempts[i];
        }
      });
      return { ...a, attempts, best, bestIdx };
    });
    // Sort by ResultRank if known, otherwise by best numeric desc, fouls last
    return enriched.sort((a, b) => {
      if (a.ResultRank != null && b.ResultRank != null) return a.ResultRank - b.ResultRank;
      if (a.ResultRank != null) return -1;
      if (b.ResultRank != null) return 1;
      const an = parseFloat((a.best ?? "").replace(",", "."));
      const bn = parseFloat((b.best ?? "").replace(",", "."));
      const av = Number.isFinite(an) ? an : -Infinity;
      const bv = Number.isFinite(bn) ? bn : -Infinity;
      return bv - av;
    });
  }, [round]);

  const visible = rows.slice(0, top);

  // Detect newly-arrived results to trigger overlay (works even if athlete is
  // outside the visible top N — overlay just animates without a row target).
  const prevResultsRef = useRef<Map<number, string>>(new Map());
  const [queue, setQueue] = useState<NewResultItem[]>([]);
  const [currentOverlay, setCurrentOverlay] = useState<NewResultItem | null>(null);

  useEffect(() => {
    if (!ev || !round) return;
    const next = new Map<number, string>();
    const newItems: NewResultItem[] = [];
    for (const heat of round.Heats) {
      for (const a of heat.Allocations) {
        const visualState = getResultVisualState(a);
        if (!visualState) continue;
        next.set(a.AllocId, visualState.signature);
        const prev = prevResultsRef.current.get(a.AllocId);
        if (prev !== undefined && prev !== visualState.signature) {
          newItems.push({
            key: `${a.AllocId}-${visualState.signature}-${Date.now()}`,
            alloc: { ...a, Result: visualState.result ?? visualState.attemptResult },
            eventId: ev.Id,
            eventCategory: ev.EventCategory ?? "",
            heatIndex: heat.Index,
            attemptIndex: visualState.attemptIndex,
          });
        }
      }
    }
    prevResultsRef.current = next;
    if (newItems.length) setQueue((q) => [...q, ...newItems]);
  }, [ev, round]);

  useEffect(() => {
    if (currentOverlay || queue.length === 0) return;
    setCurrentOverlay(queue[0]);
    setQueue((q) => q.slice(1));
  }, [currentOverlay, queue]);

  const handleOverlayDone = useCallback(() => setCurrentOverlay(null), []);

  // Wind: prefer first heat's wind; fallback to most recent allocation wind.
  const wind = useMemo<number | null>(() => {
    if (!round) return null;
    const heatWind = round.Heats[0]?.Wind;
    if (heatWind != null && Number.isFinite(heatWind)) return heatWind;
    for (const h of round.Heats) {
      for (let i = h.Allocations.length - 1; i >= 0; i--) {
        const w = h.Allocations[i]?.Wind;
        if (w != null && Number.isFinite(w)) return w;
      }
    }
    return null;
  }, [round]);

  const vw = useViewportWidth();
  const narrow = vw < 900;

  const clock = useClock();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b bg-card/95 px-4 py-2 backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ search: { eventId: undefined, roundId: undefined, top } })}
          aria-label="Takaisin"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-black leading-tight">
            {ev?.Name ?? "Ladataan…"}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {round
              ? `${round.Name} · ${formatTime(round.BeginDateTimeWithTZ)} · ${STATUS_LABEL[round.Status]}`
              : ""}
          </p>
        </div>

        <div
          className="shrink-0 font-black tabular-nums leading-none text-foreground"
          style={{ fontSize: narrow ? "1.25rem" : "1.75rem" }}
          aria-label="Kellonaika"
        >
          {narrow ? clock.slice(0, 5) : clock}
        </div>

        {wind != null && (
          <div
            className={`shrink-0 rounded-full border px-3 py-1 text-sm font-bold tabular-nums ${
              wind > 2.0
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-border bg-secondary text-secondary-foreground"
            }`}
            title="Tuuli"
          >
            Tuuli {formatWind(wind)} m/s
          </div>
        )}

        <div className="flex shrink-0 gap-1 rounded-full border bg-background p-1 text-xs font-semibold">
          {([3, 5, 10] as TopSize[]).map((n) => (
            <button
              key={String(n)}
              onClick={() => navigate({ search: (prev: SearchParams) => ({ ...prev, top: n }) })}
              className={`rounded-full px-3 py-1 transition-colors ${
                top === n
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {`Top ${n}`}
            </button>
          ))}
        </div>
        <WakeLockToggle />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => detailQ.refetch()}
          disabled={detailQ.isFetching}
          aria-label="Päivitä"
        >
          <RefreshCw className={`h-5 w-5 ${detailQ.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
        {detailQ.isLoading && (
          <div className="flex flex-1 items-center justify-center text-2xl text-muted-foreground">
            Ladataan…
          </div>
        )}

        {ev && rows.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-2xl text-muted-foreground">
            Ei vielä osallistujia.
          </div>
        )}

        {visible.length > 0 && (
          <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
            {visible.map((row, idx) => (
              <ScoreRow
                key={row.AllocId}
                row={row}
                displayRank={idx + 1}
                count={visible.length}
                eventId={ev?.Id ?? 0}
                category={ev?.EventCategory ?? ""}
                competitionId={competitionId}
                eventName={ev?.Name ?? ""}
              />
            ))}
          </ul>
        )}
      </main>
      <NewResultOverlay item={currentOverlay} onDone={handleOverlayDone} />
    </div>
  );
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { first: "", last: full };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function useClock(): string {
  const [t, setT] = useState<string>(() => formatHelsinkiClock(new Date()));
  useEffect(() => {
    const tick = () => setT(formatHelsinkiClock(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function formatHelsinkiClock(d: Date): string {
  return new Intl.DateTimeFormat("fi-FI", {
    timeZone: "Europe/Helsinki",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

function formatWind(w: number): string {
  const sign = w > 0 ? "+" : w < 0 ? "−" : "";
  return `${sign}${Math.abs(w).toFixed(1)}`;
}

function useViewportWidth(): number {
  const [w, setW] = useState<number>(() =>
    typeof window === "undefined" ? 1024 : window.innerWidth,
  );
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  return w;
}

function ScoreRow({
  row,
  displayRank,
  count,
  eventId,
  category,
  competitionId,
  eventName,
}: {
  row: RankedRow;
  displayRank: number;
  count: number;
  eventId: number;
  category: string;
  competitionId: number;
  eventName: string;
}) {
  const vw = useViewportWidth();
  const narrow = vw < 900;
  // Distribute height across rows; aim for big text but cap on small counts
  const heightStyle = { flex: "1 1 0", minHeight: 0 };
  const isLeader = displayRank === 1 && row.best;
  const rankNum = row.ResultRank ?? displayRank;
  const stackName = !narrow && count <= 5;
  const { first, last } = splitName(row.Name ?? "");

  // Detect new PB / SB against captured baseline (falls back to API PB/SB,
  // then to the athlete's historical best across age classes).
  const eff = effectiveRecord(eventId, row, {
    competitionId,
    athleteKey: athleteKey(row.Surname, row.Firstname, row.Organization?.Id ?? null),
    eventName,
  });
  const recordKind = detectRecord(category, row.best, eff.pb, eff.sb);

  const nameBlock = (
    <div className="flex min-w-0 flex-1 flex-col justify-center">
      {stackName && first ? (
        <>
          <p
            className="break-words font-semibold leading-tight text-muted-foreground"
            style={{ fontSize: firstNameFontSize(count) }}
          >
            {first}
          </p>
          <p
            className="break-words font-black leading-tight"
            style={{ fontSize: nameFontSize(count) }}
          >
            {last}
          </p>
        </>
      ) : (
        <p
          className="truncate font-black leading-tight"
          style={{ fontSize: narrow ? narrowNameFontSize(count) : nameFontSize(count) }}
        >
          {row.Name}
        </p>
      )}
      <p
        className="mt-0.5 truncate text-muted-foreground"
        style={{ fontSize: clubFontSize(count) }}
      >
        {row.Organization?.Name ?? row.Organization?.NameShort ?? ""}
        {row.Number ? ` · #${row.Number}` : ""}
      </p>
    </div>
  );

  const rankBox = (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg font-black tabular-nums ${
        narrow ? "" : "h-full"
      } ${
        isLeader
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground"
      }`}
      style={{
        fontSize: narrow ? narrowRankFontSize(count) : rankFontSize(count),
        minWidth: narrow ? "3rem" : rankBoxWidth(count),
        maxWidth: narrow ? "4rem" : rankBoxMaxWidth(count),
        paddingLeft: "0.5rem",
        paddingRight: "0.5rem",
        paddingTop: narrow ? "0.25rem" : undefined,
        paddingBottom: narrow ? "0.25rem" : undefined,
      }}
    >
      {rankNum}.
    </div>
  );

  const attMin = narrow ? narrowAttemptMinWidth(count) : attemptMinWidth(count);
  const attMax = narrow ? narrowAttemptMaxWidth(count) : attemptMaxWidth(count);
  const attValSize = narrow ? narrowAttemptValueSize(count) : attemptValueSize(count);
  const attLabSize = attemptLabelSize(count);

  const attemptsList = (
    <ol className={`flex shrink-0 items-stretch gap-1 ${narrow ? "flex-1" : "h-full"}`}>
      {row.attempts.map((att, i) => {
        const isBest = row.bestIdx === i && att != null;
        const isFoul = att && /^(x|X|-)$/.test(att.trim());
        return (
          <li
            key={i}
            className={`flex flex-col items-center justify-center rounded-md border ${
              narrow ? "px-1 py-0.5" : "px-2"
            } ${
              isBest
                ? "border-primary bg-primary text-primary-foreground"
                : isFoul
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : att
                    ? "border-border bg-secondary"
                    : "border-dashed border-border bg-background text-muted-foreground/40"
            }`}
            style={{
              minWidth: attMin,
              maxWidth: attMax,
              width: narrow ? undefined : attMax,
              flex: narrow ? "1 1 0" : undefined,
            }}
          >
            <span className="font-medium opacity-70" style={{ fontSize: attLabSize }}>
              {i + 1}.
            </span>
            <span
              className="font-black tabular-nums leading-none"
              style={{ fontSize: attValSize }}
            >
              {att ?? "–"}
            </span>
          </li>
        );
      })}
    </ol>
  );

  const resultBox = (
    <div
      className={`relative flex shrink-0 flex-col items-end justify-center rounded-lg bg-foreground/95 px-3 text-background ${
        narrow ? "" : "h-full"
      }`}
      style={{
        minWidth: narrow ? "4rem" : "5rem",
        width: narrow ? narrowResultBoxWidth(count) : resultBoxWidth(count),
        maxWidth: narrow ? narrowResultBoxWidth(count) : resultBoxWidth(count),
      }}
    >
      {recordKind && (
        <span
          className="absolute -left-5 -top-5 z-10 animate-pulse drop-shadow-lg"
          style={{ transform: count <= 5 ? "scale(2)" : "scale(1.6)", transformOrigin: "top left" }}
          aria-label={recordKind === "PB" ? "Uusi oma ennätys" : "Uusi kauden ennätys"}
        >
          <RecordStar kind={recordKind} size="lg" />
        </span>
      )}
      <span className="opacity-70" style={{ fontSize: attLabSize }}>
        Tulos
      </span>
      <span
        className="font-black tabular-nums leading-none"
        style={{ fontSize: narrow ? narrowBestFontSize(count) : bestFontSize(count) }}
      >
        {row.best ?? "–"}
      </span>
    </div>
  );

  if (narrow) {
    return (
      <li
        style={heightStyle}
        data-alloc-id={row.AllocId}
        className={`flex min-h-0 flex-col gap-1.5 overflow-hidden rounded-xl border-2 px-2 py-1.5 ${
          isLeader ? "border-primary bg-primary/10" : "border-border bg-card"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          {rankBox}
          {nameBlock}
          {resultBox}
        </div>
        <div className="min-h-0 flex-1">{attemptsList}</div>
      </li>
    );
  }

  return (
    <li
      style={heightStyle}
      data-alloc-id={row.AllocId}
      className={`flex min-h-0 items-center gap-2 overflow-hidden rounded-xl border-2 px-3 py-2 sm:gap-3 sm:px-4 ${
        isLeader ? "border-primary bg-primary/10" : "border-border bg-card"
      }`}
    >
      {rankBox}
      {nameBlock}
      {attemptsList}
      {resultBox}
    </li>
  );
}

/* Responsive font sizing based on row count using viewport units. */
function nameFontSize(count: number): string {
  if (count <= 3) return "clamp(1.5rem, 4.5vh, 4rem)";
  if (count <= 5) return "clamp(1.25rem, 3.2vh, 3rem)";
  if (count <= 10) return "clamp(1rem, 2.2vh, 2rem)";
  return "clamp(0.875rem, 1.6vh, 1.5rem)";
}
function clubFontSize(count: number): string {
  if (count <= 3) return "clamp(0.875rem, 2vh, 1.5rem)";
  if (count <= 5) return "clamp(0.75rem, 1.5vh, 1.25rem)";
  return "clamp(0.65rem, 1.2vh, 1rem)";
}
function rankFontSize(count: number): string {
  if (count <= 3) return "clamp(2rem, 6vh, 5rem)";
  if (count <= 5) return "clamp(1.5rem, 4vh, 3.5rem)";
  if (count <= 10) return "clamp(1.25rem, 3vh, 2.5rem)";
  return "clamp(1rem, 2vh, 2rem)";
}
function attemptValueSize(count: number): string {
  if (count <= 3) return "clamp(1.5rem, 4vh, 3.5rem)";
  if (count <= 5) return "clamp(1.25rem, 3vh, 2.5rem)";
  if (count <= 10) return "clamp(1rem, 2vh, 1.75rem)";
  return "clamp(0.75rem, 1.5vh, 1.25rem)";
}
function attemptLabelSize(count: number): string {
  if (count <= 5) return "clamp(0.65rem, 1.2vh, 0.9rem)";
  return "clamp(0.55rem, 1vh, 0.75rem)";
}
function bestFontSize(count: number): string {
  if (count <= 3) return "clamp(2rem, 5.5vh, 4.5rem)";
  if (count <= 5) return "clamp(1.5rem, 4vh, 3.5rem)";
  if (count <= 10) return "clamp(1.25rem, 2.8vh, 2.25rem)";
  return "clamp(1rem, 2vh, 1.5rem)";
}
function attemptMinWidth(count: number): string {
  if (count <= 3) return "4.5rem";
  if (count <= 5) return "3.75rem";
  if (count <= 10) return "3rem";
  return "2.5rem";
}
function attemptMaxWidth(count: number): string {
  if (count <= 3) return "6.5rem";
  if (count <= 5) return "5.5rem";
  if (count <= 10) return "4.5rem";
  return "3.5rem";
}
function rankBoxWidth(count: number): string {
  if (count <= 3) return "5rem";
  if (count <= 5) return "4rem";
  if (count <= 10) return "3.25rem";
  return "2.75rem";
}
function rankBoxMaxWidth(count: number): string {
  if (count <= 3) return "7rem";
  if (count <= 5) return "5.5rem";
  if (count <= 10) return "4.5rem";
  return "3.5rem";
}
function resultBoxWidth(count: number): string {
  if (count <= 3) return "9rem";
  if (count <= 5) return "8rem";
  if (count <= 10) return "7rem";
  return "5.5rem";
}
function firstNameFontSize(count: number): string {
  if (count <= 3) return "clamp(1rem, 2.6vh, 2rem)";
  return "clamp(0.875rem, 2vh, 1.5rem)";
}

/* Narrow viewport (<900px) sizing — name is on its own row, attempts share remaining width. */
function narrowNameFontSize(count: number): string {
  if (count <= 3) return "clamp(1.25rem, 4vh, 2.5rem)";
  if (count <= 5) return "clamp(1.125rem, 3vh, 2rem)";
  if (count <= 10) return "clamp(1rem, 2.4vh, 1.5rem)";
  return "clamp(0.875rem, 1.8vh, 1.25rem)";
}
function narrowRankFontSize(count: number): string {
  if (count <= 3) return "clamp(1.5rem, 4.5vh, 3rem)";
  if (count <= 5) return "clamp(1.25rem, 3.5vh, 2.25rem)";
  if (count <= 10) return "clamp(1rem, 2.8vh, 1.75rem)";
  return "clamp(0.875rem, 2vh, 1.5rem)";
}
function narrowAttemptMinWidth(_count: number): string {
  return "0";
}
function narrowAttemptMaxWidth(_count: number): string {
  return "100%";
}
function narrowAttemptValueSize(count: number): string {
  if (count <= 3) return "clamp(1.25rem, 3.5vh, 2.25rem)";
  if (count <= 5) return "clamp(1rem, 2.8vh, 1.75rem)";
  if (count <= 10) return "clamp(0.875rem, 2vh, 1.375rem)";
  return "clamp(0.75rem, 1.6vh, 1.125rem)";
}
function narrowResultBoxWidth(count: number): string {
  if (count <= 3) return "5.5rem";
  if (count <= 5) return "5rem";
  if (count <= 10) return "4.5rem";
  return "4rem";
}
function narrowBestFontSize(count: number): string {
  if (count <= 3) return "clamp(1.5rem, 4vh, 2.5rem)";
  if (count <= 5) return "clamp(1.25rem, 3.2vh, 2rem)";
  if (count <= 10) return "clamp(1.125rem, 2.6vh, 1.75rem)";
  return "clamp(1rem, 2vh, 1.5rem)";
}
