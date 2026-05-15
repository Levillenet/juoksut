import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, Maximize2 } from "lucide-react";

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

type TopSize = 3 | 5 | 10 | "all";

interface SearchParams {
  eventId?: number;
  roundId?: number;
  top: TopSize;
}

function parseTop(v: unknown): TopSize {
  if (v === 3 || v === "3") return 3;
  if (v === 5 || v === "5") return 5;
  if (v === "all") return "all";
  return 10;
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
  }),
  component: () => (
    <RequireRole allow={["official"]}>
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
            {([3, 5, 10, "all"] as TopSize[]).map((n) => (
              <button
                key={String(n)}
                onClick={() => navigate({ search: (prev: SearchParams) => ({ ...prev, top: n }) })}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  top === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-secondary"
                }`}
              >
                {n === "all" ? "Kaikki" : `Top ${n}`}
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

  const visible = top === "all" ? rows : rows.slice(0, top);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-3 border-b bg-card/95 px-4 py-2 backdrop-blur">
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
        <div className="flex shrink-0 gap-1 rounded-full border bg-background p-1 text-xs font-semibold">
          {([3, 5, 10, "all"] as TopSize[]).map((n) => (
            <button
              key={String(n)}
              onClick={() => navigate({ search: (prev: SearchParams) => ({ ...prev, top: n }) })}
              className={`rounded-full px-3 py-1 transition-colors ${
                top === n
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {n === "all" ? "Kaikki" : `Top ${n}`}
            </button>
          ))}
        </div>
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
              <ScoreRow key={row.AllocId} row={row} displayRank={idx + 1} count={visible.length} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { first: "", last: full };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function ScoreRow({
  row,
  displayRank,
  count,
}: {
  row: RankedRow;
  displayRank: number;
  count: number;
}) {
  // Distribute height across rows; aim for big text but cap on small counts
  const heightStyle = { flex: "1 1 0", minHeight: 0 };
  const isLeader = displayRank === 1 && row.best;
  const rankNum = row.ResultRank ?? displayRank;
  const stackName = count <= 5;
  const { first, last } = splitName(row.Name ?? "");

  return (
    <li
      style={heightStyle}
      className={`flex min-h-0 items-center gap-2 overflow-hidden rounded-xl border-2 px-3 py-2 sm:gap-3 sm:px-4 ${
        isLeader
          ? "border-primary bg-primary/10"
          : "border-border bg-card"
      }`}
    >
      <div
        className={`flex h-full shrink-0 items-center justify-center rounded-lg font-black tabular-nums ${
          isLeader
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        }`}
        style={{
          fontSize: rankFontSize(count),
          minWidth: rankBoxWidth(count),
          maxWidth: rankBoxMaxWidth(count),
          paddingLeft: "0.5rem",
          paddingRight: "0.5rem",
        }}
      >
        {rankNum}.
      </div>

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
            className={`font-black leading-tight ${stackName ? "break-words" : "truncate"}`}
            style={{ fontSize: nameFontSize(count) }}
          >
            {row.Name}
          </p>
        )}
        <p
          className="mt-1 truncate text-muted-foreground"
          style={{ fontSize: clubFontSize(count) }}
        >
          {row.Organization?.Name ?? row.Organization?.NameShort ?? ""}
          {row.Number ? ` · #${row.Number}` : ""}
        </p>
      </div>

      <ol className="flex h-full shrink-0 items-stretch gap-1">
        {row.attempts.map((att, i) => {
          const isBest = row.bestIdx === i && att != null;
          const isFoul = att && /^(x|X|-)$/.test(att.trim());
          return (
            <li
              key={i}
              className={`flex flex-col items-center justify-center rounded-md border px-2 ${
                isBest
                  ? "border-primary bg-primary text-primary-foreground"
                  : isFoul
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : att
                      ? "border-border bg-secondary"
                      : "border-dashed border-border bg-background text-muted-foreground/40"
              }`}
              style={{
                minWidth: attemptMinWidth(count),
                maxWidth: attemptMaxWidth(count),
                width: attemptMaxWidth(count),
              }}
            >
              <span
                className="font-medium opacity-70"
                style={{ fontSize: attemptLabelSize(count) }}
              >
                {i + 1}.
              </span>
              <span
                className="font-black tabular-nums leading-none"
                style={{ fontSize: attemptValueSize(count) }}
              >
                {att ?? "–"}
              </span>
            </li>
          );
        })}
      </ol>

      <div
        className="flex h-full shrink-0 flex-col items-end justify-center rounded-lg bg-foreground/95 px-3 text-background"
        style={{
          minWidth: "5rem",
          width: resultBoxWidth(count),
          maxWidth: resultBoxWidth(count),
        }}
      >
        <span
          className="opacity-70"
          style={{ fontSize: attemptLabelSize(count) }}
        >
          Tulos
        </span>
        <span
          className="font-black tabular-nums leading-none"
          style={{ fontSize: bestFontSize(count) }}
        >
          {row.best ?? "–"}
        </span>
      </div>
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
  if (count <= 3) return "5rem";
  if (count <= 5) return "4rem";
  if (count <= 10) return "3rem";
  return "2.5rem";
}
