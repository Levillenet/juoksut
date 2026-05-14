import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, Trophy, Activity, Clock, ChevronDown, Star } from "lucide-react";

import {
  fetchRounds,
  fetchEvent,
  fetchProperties,
  formatTime,
  helsinkiDateKey,
  translateSub,
  type Round,
  type RoundsByDate,
  type Allocation,
  type EventResults,
} from "@/lib/tuloslista";
import { useCompetitionId } from "@/lib/competition-store";
import { Button } from "@/components/ui/button";
import logo from "@/assets/lahden-ahkera-logo.png";

export const Route = createFileRoute("/announcer")({
  head: () => ({
    meta: [
      { title: "Kuuluttajan dashboard" },
      {
        name: "description",
        content:
          "Desktop-kokoinen kuuluttajanäkymä: käynnissä olevien lajien kärki ja juuri valmistuneet tulokset.",
      },
    ],
  }),
  component: AnnouncerPage,
});

type DetailCache = { [k: number]: EventResults };

function AnnouncerPage() {
  const [competitionId] = useCompetitionId();
  const [data, setData] = useState<RoundsByDate | null>(null);
  const [name, setName] = useState("");
  const [details, setDetails] = useState<DetailCache>({});
  const [now, setNow] = useState<Date | null>(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [showRunning, setShowRunning] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [showPastUpcoming, setShowPastUpcoming] = useState(false);

  const loadSchedule = async (silent = true) => {
    if (!silent) setManualLoading(true);
    try {
      const [r, p] = await Promise.all([
        fetchRounds(competitionId),
        fetchProperties(competitionId).catch(() => null),
      ]);
      setData(r);
      setName(p?.Competition?.Name ?? "");
      setUpdatedAt(new Date());
    } finally {
      if (!silent) setManualLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule(false);
    const t = setInterval(() => loadSchedule(true), 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId]);

  // Client-only clock to avoid SSR hydration mismatch
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  const todayKey = helsinkiDateKey((now ?? new Date()).toISOString());
  const todayRounds = useMemo<Round[]>(() => {
    if (!data) return [];
    return [...(data[todayKey] ?? [])].sort((a, b) =>
      a.BeginDateTimeWithTZ.localeCompare(b.BeginDateTimeWithTZ),
    );
  }, [data, todayKey]);

  const inProgressAll = todayRounds.filter((r) => r.Status === "Progress");
  const inProgress = showRunning
    ? inProgressAll
    : inProgressAll.filter((r) => r.Category !== "Track");
  const completed = todayRounds.filter((r) => r.Status === "Official").reverse();
  const nowMs = (now ?? new Date()).getTime();
  const upcomingAll = todayRounds.filter(
    (r) => r.Status !== "Official" && r.Status !== "Progress",
  );
  const upcoming = (
    showPastUpcoming
      ? upcomingAll
      : upcomingAll.filter((r) => new Date(r.BeginDateTimeWithTZ).getTime() > nowMs - 5 * 60_000)
  ).slice(0, 20);
  const pastUpcomingCount = upcomingAll.length - upcoming.length;

  // Auto-fetch details for in-progress, completed, and any expanded upcoming events
  const wantedIds = useMemo(() => {
    const ids = new Set<number>();
    inProgress.forEach((r) => ids.add(r.EventId));
    completed.forEach((r) => ids.add(r.EventId));
    expanded.forEach((id) => ids.add(id));
    return Array.from(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(inProgress.map((r) => r.EventId)),
    JSON.stringify(completed.map((r) => r.EventId)),
    expanded,
  ]);

  useEffect(() => {
    if (wantedIds.length === 0) return;
    let cancelled = false;
    const tick = async () => {
      const results = await Promise.allSettled(
        wantedIds.map((id) => fetchEvent(competitionId, id)),
      );
      if (cancelled) return;
      setDetails((prev) => {
        const next = { ...prev };
        results.forEach((res, i) => {
          if (res.status === "fulfilled") next[wantedIds[i]] = res.value;
        });
        return next;
      });
    };
    tick();
    const t = setInterval(tick, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [competitionId, wantedIds]);

  const toggleExpand = (eventId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="relative mx-auto flex max-w-[1600px] items-center gap-3 px-6 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Takaisin">
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <img
            src={logo}
            alt="Lahden Ahkera"
            className="h-14 w-14 shrink-0 rounded-lg object-contain"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight">
              {name || `Kisa #${competitionId}`}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {todayKey}
              {updatedAt && now && ` · päivitetty ${pad(updatedAt.getHours())}:${pad(updatedAt.getMinutes())}:${pad(updatedAt.getSeconds())}`}
            </p>
          </div>
          <h2 className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-3xl font-black uppercase tracking-widest text-primary lg:block">
            Kuuluttajan näkymä
          </h2>
          <div className="text-right" suppressHydrationWarning>
            <div className="text-3xl font-black tabular-nums leading-none">
              {now ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : "--:--"}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {inProgressAll.length} käynnissä · {completed.length} valmis
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => loadSchedule(false)} aria-label="Päivitä">
            <RefreshCw className={`h-5 w-5 ${manualLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between gap-2">
              <SectionTitle icon={<Activity className="h-4 w-4" />} title="Käynnissä" count={inProgress.length} />
              <div className="flex gap-1 rounded-full border border-border bg-card p-1 text-xs font-medium">
                <button
                  onClick={() => setShowRunning(false)}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    !showRunning ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  Kenttälajit
                </button>
                <button
                  onClick={() => setShowRunning(true)}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    showRunning ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  Kaikki lajit
                </button>
              </div>
            </div>
            {inProgress.length === 0 ? (
              <EmptyCard text={showRunning ? "Ei käynnissä olevia lajeja." : "Ei käynnissä olevia kenttälajeja."} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {inProgress.map((r) => (
                  <EventCard
                    key={r.Id}
                    round={r}
                    detail={details[r.EventId]}
                    live
                    open={expanded.has(r.EventId)}
                    onToggle={() => toggleExpand(r.EventId)}
                  />
                ))}
              </div>
            )}

            <div className="mt-8">
              <SectionTitle icon={<Trophy className="h-4 w-4" />} title="Lopputulokset" count={completed.length} />
              {completed.length === 0 ? (
                <EmptyCard text="Ei julkaistuja lopputuloksia vielä." />
              ) : (
                <ul className="grid gap-2 md:grid-cols-2">
                  {completed.map((r) => (
                    <UpcomingItem
                      key={r.Id}
                      round={r}
                      detail={details[r.EventId]}
                      open={expanded.has(r.EventId)}
                      onToggle={() => toggleExpand(r.EventId)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>

          <aside>
            <div className="mb-3 flex items-center justify-between gap-2">
              <SectionTitle icon={<Clock className="h-4 w-4" />} title="Seuraavaksi" count={upcoming.length} />
              <button
                onClick={() => setShowPastUpcoming((v) => !v)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  showPastUpcoming
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-secondary"
                }`}
              >
                {showPastUpcoming
                  ? "Piilota menneet"
                  : `Näytä menneet${pastUpcomingCount > 0 ? ` (${pastUpcomingCount})` : ""}`}
              </button>
            </div>
            {upcoming.length === 0 ? (
              <EmptyCard
                text={
                  pastUpcomingCount > 0
                    ? "Ei enää tulevia lajeja. Paina ”Näytä menneet”."
                    : "Ei tulevia lajeja tänään."
                }
              />
            ) : (
              <ul className="space-y-2">
                {upcoming.map((r) => (
                  <UpcomingItem
                    key={r.Id}
                    round={r}
                    detail={details[r.EventId]}
                    open={expanded.has(r.EventId)}
                    onToggle={() => toggleExpand(r.EventId)}
                  />
                ))}
              </ul>
            )}
          </aside>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Lähde: live.tuloslista.com · automaattinen päivitys 15&nbsp;s välein
        </p>
      </main>
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function SectionTitle({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
        {icon}
      </span>
      <h2 className="text-sm font-bold uppercase tracking-widest">{title}</h2>
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
        {count}
      </span>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function flattenAllocations(detail?: EventResults): Allocation[] {
  if (!detail) return [];
  const all: Allocation[] = [];
  detail.Rounds.forEach((rd) => rd.Heats.forEach((h) => all.push(...h.Allocations)));
  return all;
}

function rankedTop(detail: EventResults | undefined, n: number): Allocation[] {
  return flattenAllocations(detail)
    .filter((a) => !a.NotInCompetition && (a.ResultRank != null || a.Result))
    .sort((a, b) => (a.ResultRank ?? 999) - (b.ResultRank ?? 999))
    .slice(0, n);
}

// --- PB/SB highlight helpers ----------------------------------------------
function parsePerf(s: string | null | undefined): number | null {
  if (!s) return null;
  const norm = s.replace(",", ".").trim();
  if (!norm) return null;
  if (norm.includes(":")) {
    const parts = norm.split(":").map(parseFloat);
    if (parts.some(isNaN)) return null;
    return parts.reduce((acc, x) => acc * 60 + x, 0);
  }
  const v = parseFloat(norm);
  return isNaN(v) ? null : v;
}

type RecordKind = "PB" | "SB" | null;

function detectRecord(category: string, result: string | null, pb: string, sb: string): RecordKind {
  const r = parsePerf(result);
  if (r == null) return null;
  const isTrack = category === "Track";
  const better = (a: number, b: number) => (isTrack ? a <= b : a >= b);
  const p = parsePerf(pb);
  if (p != null && better(r, p)) return "PB";
  const s = parsePerf(sb);
  if (s != null && better(r, s)) return "SB";
  return null;
}

function RecordStar({ kind, size = "lg" }: { kind: "PB" | "SB"; size?: "lg" | "sm" }) {
  const px = size === "lg" ? 36 : 26;
  const fontClass = size === "lg" ? "text-[10px]" : "text-[8px]";
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: px, height: px }}
      title={kind === "PB" ? "Uusi oma ennätys" : "Uusi kauden ennätys"}
      aria-label={kind === "PB" ? "Uusi oma ennätys" : "Uusi kauden ennätys"}
    >
      <Star
        className="fill-yellow-400 text-yellow-500 drop-shadow-sm"
        size={px}
        strokeWidth={1.5}
      />
      <span className={`absolute font-black text-black ${fontClass}`}>{kind}</span>
    </span>
  );
}

function EventCard({
  round,
  detail,
  live = false,
  open = false,
  onToggle,
}: {
  round: Round;
  detail?: EventResults;
  live?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  const top3 = useMemo(() => rankedTop(detail, 3), [detail]);
  const allRanked = useMemo(
    () =>
      flattenAllocations(detail)
        .filter((a) => a.ResultRank != null || a.Result || a.Position != null)
        .sort((a, b) => {
          const ar = a.ResultRank ?? a.Position ?? 999;
          const br = b.ResultRank ?? b.Position ?? 999;
          return ar - br;
        }),
    [detail],
  );
  const list = open ? allRanked : top3;

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-card ${
        live ? "border-primary/60 ring-1 ring-primary/30" : "border-border"
      }`}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-baseline justify-between gap-3 p-4 text-left hover:bg-secondary/50"
      >
        <div className="min-w-0">
          <p className="truncate text-xl font-bold leading-tight">{round.EventName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {round.Name}
            {round.SubCategory && ` · ${translateSub(round.SubCategory)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {live ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground" />
              Live
            </span>
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">
              {formatTime(round.BeginDateTimeWithTZ)}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      <div className="px-4 pb-4">
      {list.length === 0 ? (
        <p className="rounded-lg bg-muted/50 px-3 py-4 text-center text-xs text-muted-foreground">
          {detail ? "Tulokset eivät vielä saatavilla" : "Ladataan tuloksia…"}
        </p>
      ) : (
        <ol className="space-y-1.5">
          {list.map((a) => {
            const rec = detectRecord(round.Category, a.Result, a.PB, a.SB);
            const rank = a.ResultRank ?? a.Position;
            return (
              <li
                key={a.AllocId}
                className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black tabular-nums ${
                    rank === 1
                      ? "bg-primary text-primary-foreground"
                      : rank === 2
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {rank ?? "–"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-tight">{a.Name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.Organization?.Name ?? a.Organization?.NameShort ?? ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {rec && <RecordStar kind={rec} size="lg" />}
                  {a.Result ? (
                    <span className="text-base font-bold tabular-nums">{a.Result}</span>
                  ) : (
                    <span className="flex gap-2 text-xs text-muted-foreground">
                      {a.SB && <span title="Kauden ennätys">SB {a.SB}</span>}
                      {a.PB && <span title="Oma ennätys">PB {a.PB}</span>}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {open && (
        <div className="mt-3 text-right">
          <Link
            to="/round/$eventId/$roundId"
            params={{ eventId: String(round.EventId), roundId: String(round.Id) }}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Avaa täysi näkymä →
          </Link>
        </div>
      )}
      </div>
    </div>
  );
}

function UpcomingItem({
  round,
  detail,
  open,
  onToggle,
}: {
  round: Round;
  detail?: EventResults;
  open: boolean;
  onToggle: () => void;
}) {
  const allocations = useMemo(() => flattenAllocations(detail), [detail]);
  const hasResults = allocations.some((a) => a.Result);
  const sorted = useMemo(() => {
    if (hasResults) {
      return [...allocations].sort((a, b) => (a.ResultRank ?? 999) - (b.ResultRank ?? 999));
    }
    return [...allocations].sort((a, b) => (a.Position ?? 999) - (b.Position ?? 999));
  }, [allocations, hasResults]);

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3 text-left hover:bg-secondary/50"
      >
        <div className="w-14 shrink-0 text-xl font-bold tabular-nums">
          {formatTime(round.BeginDateTimeWithTZ)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{round.EventName}</p>
          <p className="truncate text-xs text-muted-foreground">{round.Name}</p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="border-t border-border bg-background/40 p-3">
          {!detail ? (
            <p className="py-3 text-center text-xs text-muted-foreground">Ladataan…</p>
          ) : sorted.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              Osallistujia ei vielä julkaistu.
            </p>
          ) : (
            <ol className="space-y-1">
              {sorted.map((a) => {
                const rec = detectRecord(round.Category, a.Result, a.PB, a.SB);
                return (
                  <li
                    key={a.AllocId}
                    className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                      a.NotInCompetition ? "text-muted-foreground" : ""
                    }`}
                  >
                    <span className="w-6 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                      {hasResults ? (a.ResultRank ?? "–") : (a.Position ?? "–")}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {a.Name}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {a.Organization?.Name ?? ""}
                      </span>
                    </span>
                    {a.Result ? (
                      <span className="flex shrink-0 items-center gap-1">
                        {rec && (
                          <span
                            className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase ${
                              rec === "PB"
                                ? "bg-primary text-primary-foreground"
                                : "bg-accent text-accent-foreground"
                            }`}
                            title={rec === "PB" ? "Uusi oma ennätys" : "Uusi kauden ennätys"}
                          >
                            {rec === "PB" ? "Uusi PB" : "Uusi SB"}
                          </span>
                        )}
                        <span className="font-bold tabular-nums">{a.Result}</span>
                      </span>
                    ) : (
                      <span className="flex shrink-0 gap-2 text-xs text-muted-foreground">
                        {a.SB && <span title="Kauden ennätys">SB {a.SB}</span>}
                        {a.PB && <span title="Oma ennätys">PB {a.PB}</span>}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </li>
  );
}
