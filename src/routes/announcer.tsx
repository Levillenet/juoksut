import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, Trophy, Activity, Clock, ChevronDown, Star, ArrowUp, ArrowDown } from "lucide-react";
import { detectRecord, formatImprovement, RecordBadge, RecordStar } from "@/lib/records";
import { effectiveRecord } from "@/lib/record-baseline";

import {
  formatTime,
  helsinkiDateKey,
  translateSub,
  type Round,
  type Allocation,
  type EventResults,
} from "@/lib/tuloslista";
import {
  competitionScheduleQueryOptions,
  competitionScheduleKey,
  eventDetailsQueryOptions,
  eventDetailsKey,
} from "@/lib/tuloslista-queries";
import { useCompetitionId } from "@/lib/competition-store";
import { Button } from "@/components/ui/button";
import logo from "@/assets/lahden-ahkera-logo.png";

import { RequireRole } from "@/components/RequireRole";

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
  component: () => (
    <RequireRole allow={["official"]}>
      <AnnouncerPage />
    </RequireRole>
  ),
});

type DetailCache = { [k: number]: EventResults };

interface RecordAlert {
  id: string;
  kind: "PB" | "SB";
  athleteName: string;
  organization: string;
  eventName: string;
  category: string;
  result: string;
  previous: string;
  shownAt: number;
  eventId: number;
  roundId: number;
}

const MAX_RECORDS = 50;
const VISIBLE_RECORDS = 3;

function AnnouncerPage() {
  const [competitionId] = useCompetitionId();
  const queryClient = useQueryClient();
  const [now, setNow] = useState<Date | null>(null);
  const [showRunning, setShowRunning] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showPastUpcoming, setShowPastUpcoming] = useState(false);
  const [recordAlerts, setRecordAlerts] = useState<RecordAlert[]>([]);
  const [recordsCollapsed, setRecordsCollapsed] = useState(false);
  const [recordsExpanded, setRecordsExpanded] = useState(false);
  const [includeSB, setIncludeSB] = useState(false);
  const seenResultsRef = useRef<Map<number, string>>(new Map());
  const initializedRef = useRef(false);

  const scheduleQuery = useQuery(competitionScheduleQueryOptions(competitionId));
  const data = scheduleQuery.data?.rounds ?? null;
  const name = scheduleQuery.data?.name ?? "";
  const updatedAt = scheduleQuery.dataUpdatedAt
    ? new Date(scheduleQuery.dataUpdatedAt)
    : null;
  const manualLoading = scheduleQuery.isFetching;

  const reload = () => {
    queryClient.invalidateQueries({ queryKey: competitionScheduleKey(competitionId) });
    // Also invalidate any cached event details for this competition
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        q.queryKey[0] === "event-details" &&
        q.queryKey[1] === competitionId,
    });
  };

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
  const completedAll = todayRounds.filter((r) => r.Status === "Official").reverse();

  // Per-day dismissed completed rounds (kept in localStorage so the announcer
  // can mark events as "read" and they disappear from the Lopputulokset list.)
  const dismissKey = `announcer-dismissed-${competitionId}-${todayKey}`;
  const [dismissedCompletedIds, setDismissedCompletedIds] = useState<Set<number>>(
    new Set(),
  );
  useEffect(() => {
    try {
      const raw = localStorage.getItem(dismissKey);
      setDismissedCompletedIds(new Set(raw ? (JSON.parse(raw) as number[]) : []));
    } catch {
      setDismissedCompletedIds(new Set());
    }
  }, [dismissKey]);
  const persistDismissed = (next: Set<number>) => {
    setDismissedCompletedIds(next);
    try {
      localStorage.setItem(dismissKey, JSON.stringify(Array.from(next)));
    } catch {
      /* ignore */
    }
  };
  const dismissCompleted = (roundId: number) => {
    const next = new Set(dismissedCompletedIds);
    next.add(roundId);
    persistDismissed(next);
  };
  const restoreDismissed = () => persistDismissed(new Set());

  const completed = completedAll.filter((r) => !dismissedCompletedIds.has(r.Id));
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

  const detailQueries = useQueries({
    queries: wantedIds.map((id) => eventDetailsQueryOptions(competitionId, id)),
  });

  const details: DetailCache = useMemo(() => {
    const out: DetailCache = {};
    detailQueries.forEach((q, i) => {
      if (q.data) out[wantedIds[i]] = q.data;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailQueries.map((q) => q.dataUpdatedAt).join(","), wantedIds]);

  // Detect new PB/SB results when details update; show alert banner for ~1 min
  useEffect(() => {
    const seen = seenResultsRef.current;
    const fresh: RecordAlert[] = [];
    const isFirstRun = !initializedRef.current;
    Object.values(details).forEach((ev) => {
      ev.Rounds.forEach((round) => {
        round.Heats.forEach((heat) => {
          heat.Allocations.forEach((a) => {
            if (!a.Result || a.NotInCompetition) return;
            const prevResult = seen.get(a.AllocId);
            seen.set(a.AllocId, a.Result);
            if (isFirstRun) return; // skip alerts on first load (avoid flooding)
            if (prevResult === a.Result) return; // no change
            const eff = effectiveRecord(ev.Id, a);
            const rec = detectRecord(ev.EventCategory, a.Result, eff.pb, eff.sb);
            if (!rec) return;
            fresh.push({
              id: `${a.AllocId}-${a.Result}`,
              kind: rec,
              athleteName: a.Name,
              organization: a.Organization?.Name ?? "",
              eventName: ev.Name,
              category: ev.EventCategory,
              result: a.Result,
              previous: rec === "PB" ? eff.pb : eff.sb,
              shownAt: Date.now(),
              eventId: ev.Id,
              roundId: round.Id,
            });
          });
        });
      });
    });
    initializedRef.current = true;
    if (fresh.length > 0) {
      setRecordAlerts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const merged = [...fresh.filter((f) => !existingIds.has(f.id)), ...prev];
        return merged.slice(0, MAX_RECORDS);
      });
    }
  }, [details]);

  const clearRecords = () => setRecordAlerts([]);

  const filteredRecords = useMemo(
    () => (includeSB ? recordAlerts : recordAlerts.filter((a) => a.kind === "PB")),
    [recordAlerts, includeSB],
  );

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
          <Button variant="ghost" size="icon" onClick={reload} aria-label="Päivitä">
            <RefreshCw className={`h-5 w-5 ${manualLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <div className="sticky top-[68px] z-10 border-b border-yellow-400/40 bg-yellow-50/95 backdrop-blur dark:bg-yellow-950/60">
        <div className="mx-auto max-w-[1600px] px-6 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-500" />
              <h2 className="text-sm font-bold uppercase tracking-widest">
                Uudet ennätykset
              </h2>
              <span className="rounded-full bg-yellow-400/30 px-2 py-0.5 text-xs font-semibold">
                {filteredRecords.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {!recordsCollapsed && (
                <div className="mr-1 flex gap-1 rounded-full border border-border bg-card p-1 text-xs font-medium">
                  <button
                    onClick={() => setIncludeSB(false)}
                    className={`rounded-full px-3 py-0.5 transition-colors ${
                      !includeSB ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    Vain PB
                  </button>
                  <button
                    onClick={() => setIncludeSB(true)}
                    className={`rounded-full px-3 py-0.5 transition-colors ${
                      includeSB ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    PB + SB
                  </button>
                </div>
              )}
              {filteredRecords.length > VISIBLE_RECORDS && !recordsCollapsed && (
                <button
                  onClick={() => setRecordsExpanded((v) => !v)}
                  className="rounded-full border border-yellow-400/60 bg-card px-3 py-1 text-xs font-medium hover:bg-secondary"
                >
                  {recordsExpanded ? "Näytä vain 3" : `Näytä kaikki (${filteredRecords.length})`}
                </button>
              )}
              {recordAlerts.length > 0 && !recordsCollapsed && (
                <button
                  onClick={clearRecords}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary"
                >
                  Tyhjennä
                </button>
              )}
              <button
                onClick={() => setRecordsCollapsed((v) => !v)}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-secondary"
                aria-label={recordsCollapsed ? "Näytä ennätykset" : "Pienennä"}
              >
                {recordsCollapsed ? "Avaa" : "Pienennä"}
              </button>
            </div>
          </div>

          {!recordsCollapsed && (
            <div className="mt-2 space-y-2">
              {filteredRecords.length === 0 ? (
                <p className="rounded-lg border border-dashed border-yellow-400/40 bg-card/60 px-4 py-3 text-center text-xs text-muted-foreground">
                  Ei vielä uusia {includeSB ? "PB- tai SB-" : "PB-"}ennätyksiä tänään.
                </p>
              ) : (
                (recordsExpanded ? filteredRecords : filteredRecords.slice(0, VISIBLE_RECORDS)).map((a) => {
                  const imp = formatImprovement(a.category, a.result, a.previous);
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-4 rounded-lg border border-yellow-400/60 bg-card px-4 py-2 shadow-sm"
                    >
                      <RecordStar kind={a.kind} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold leading-tight">
                          {a.athleteName}
                          {a.organization && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {a.organization}
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.eventName} · uusi {a.kind === "PB" ? "henkilökohtainen" : "kauden"} ennätys
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black tabular-nums leading-none text-primary">
                          {a.result}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {a.previous ? `ed. ${a.previous}` : "ensimmäinen tulos"}
                        </div>
                      </div>
                      {imp && (
                        <div className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-1 text-right">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                            Parannus
                          </div>
                          <div className="text-sm font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                            {imp}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

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
              <div className="mb-3 flex items-center justify-between gap-2">
                <SectionTitle
                  icon={<Trophy className="h-4 w-4" />}
                  title="Lopputulokset"
                  count={completedAll.length}
                />
                {dismissedCompletedIds.size > 0 && (
                  <button
                    onClick={restoreDismissed}
                    className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary"
                  >
                    Palauta piilotetut ({dismissedCompletedIds.size})
                  </button>
                )}
              </div>
              {completedAll.length === 0 ? (
                <EmptyCard text="Ei julkaistuja lopputuloksia vielä." />
              ) : completed.length === 0 ? (
                <EmptyCard text="Kaikki lopputulokset merkitty luetuiksi." />
              ) : (
                <ul className="grid gap-2 md:grid-cols-2">
                  {completed.map((r) => (
                    <UpcomingItem
                      key={r.Id}
                      round={r}
                      detail={details[r.EventId]}
                      groupHeats={false}
                      defaultOpen
                      onDismiss={() => dismissCompleted(r.Id)}
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

// PB/SB helpers moved to src/lib/records.tsx

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

  // Track rank changes between detail updates so we can show ↑ / ↓ next to
  // athletes whose position improved or dropped during the live event.
  // Arrow stays visible until the athlete's rank changes again.
  const prevRanksRef = useRef<Map<number, number>>(new Map());
  const [rankChanges, setRankChanges] = useState<Map<number, "up" | "down">>(
    new Map(),
  );
  useEffect(() => {
    const prev = prevRanksRef.current;
    const newChanges: Array<[number, "up" | "down"]> = [];
    const next = new Map<number, number>();
    for (const a of allRanked) {
      const cur = a.ResultRank ?? a.Position;
      if (cur == null) continue;
      next.set(a.AllocId, cur);
      const before = prev.get(a.AllocId);
      if (before != null && before !== cur) {
        newChanges.push([a.AllocId, cur < before ? "up" : "down"]);
      }
    }
    prevRanksRef.current = next;
    if (newChanges.length === 0) return;
    setRankChanges((old) => {
      const m = new Map(old);
      for (const [id, dir] of newChanges) m.set(id, dir);
      return m;
    });
  }, [allRanked]);

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
            const rank = a.ResultRank ?? a.Position;
            const change = rankChanges.get(a.AllocId);
            const eff = a.Result ? effectiveRecord(round.EventId, a) : null;
            const recordKind = a.Result && eff ? detectRecord(round.Category, a.Result, eff.pb, eff.sb) : null;
            return (
              <li
                key={a.AllocId}
                className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-2 rounded-lg bg-muted/40 px-3 py-2 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:gap-x-3"
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
                {change === "up" ? (
                  <ArrowUp
                    className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-label="Sijoitus parani"
                  />
                ) : change === "down" ? (
                  <ArrowDown
                    className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
                    aria-label="Sijoitus putosi"
                  />
                ) : (
                  <span className="h-4 w-4 shrink-0" aria-hidden />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight">{a.Name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.Organization?.Name ?? a.Organization?.NameShort ?? ""}
                  </p>
                </div>
                <div className="col-start-3 col-end-4 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 sm:col-start-4 sm:col-end-5 sm:mt-0 sm:shrink-0 sm:justify-end">
                  {a.Result ? (
                    <span className="text-base font-bold tabular-nums">{a.Result}</span>
                  ) : (
                    <span className="flex gap-2 text-xs text-muted-foreground">
                      {a.SB && <span title="Kauden ennätys">SB {a.SB}</span>}
                      {a.PB && <span title="Oma ennätys">PB {a.PB}</span>}
                    </span>
                  )}
                </div>
                {recordKind && eff && a.Result && (
                  <div className="col-start-3 col-end-4 mt-1 min-w-0 overflow-hidden sm:col-end-5">
                    <RecordBadge
                      category={round.Category}
                      result={a.Result}
                      pb={eff.pb}
                      sb={eff.sb}
                      size="sm"
                    />
                  </div>
                )}
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

function AllocationRow({
  a,
  round,
  showRank,
}: {
  a: Allocation;
  round: Round;
  showRank: "result" | "position";
}) {
  const rank = showRank === "result" ? a.ResultRank : a.Position;
  const eff = a.Result ? effectiveRecord(round.EventId, a) : null;
  const recordKind = a.Result && eff ? detectRecord(round.Category, a.Result, eff.pb, eff.sb) : null;
  return (
    <li
      className={`flex items-start gap-2 rounded px-2 py-1 text-sm ${
        a.NotInCompetition ? "text-muted-foreground" : ""
      }`}
    >
      <span className="mt-0.5 w-6 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
        {rank ?? "–"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate">{a.Name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {a.Organization?.Name ?? ""}
            </span>
          </span>
          {a.Result ? (
            <span className="shrink-0 font-bold tabular-nums">{a.Result}</span>
          ) : (
            <span className="flex shrink-0 gap-2 text-xs text-muted-foreground">
              {a.SB && <span title="Kauden ennätys">SB {a.SB}</span>}
              {a.PB && <span title="Oma ennätys">PB {a.PB}</span>}
            </span>
          )}
        </div>
        {recordKind && eff && a.Result && (
          <div className="mt-1 min-w-0 overflow-hidden">
            <RecordBadge
              category={round.Category}
              result={a.Result}
              pb={eff.pb}
              sb={eff.sb}
              size="sm"
            />
          </div>
        )}
      </div>
    </li>
  );
}

function UpcomingItem({
  round,
  detail,
  open: openProp,
  onToggle,
  groupHeats = true,
  defaultOpen = false,
  onDismiss,
}: {
  round: Round;
  detail?: EventResults;
  open?: boolean;
  onToggle?: () => void;
  groupHeats?: boolean;
  defaultOpen?: boolean;
  onDismiss?: () => void;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const handleToggle = () => {
    if (isControlled) onToggle?.();
    else setInternalOpen((v) => !v);
  };
  // Find the matching round inside the event detail (an event can contain
  // qualifications + final, etc.).
  const matchingRound = useMemo(
    () => detail?.Rounds.find((r) => r.Id === round.Id) ?? detail?.Rounds[0],
    [detail, round.Id],
  );
  const heats = matchingRound?.Heats ?? [];
  const allocations = useMemo(
    () => heats.flatMap((h) => h.Allocations),
    [heats],
  );
  const hasResults = allocations.some((a) => a.Result);
  const isTrackHeats = groupHeats && round.Category === "Track" && heats.length > 1;

  const sortAllocs = (list: Allocation[]) => {
    if (hasResults) {
      return [...list].sort(
        (a, b) => (a.ResultRank ?? 999) - (b.ResultRank ?? 999),
      );
    }
    return [...list].sort((a, b) => (a.Position ?? 999) - (b.Position ?? 999));
  };

  const flatSorted = useMemo(() => sortAllocs(allocations), [allocations, hasResults]);

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        onClick={handleToggle}
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
          ) : allocations.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              Osallistujia ei vielä julkaistu.
            </p>
          ) : isTrackHeats ? (
            <div className="space-y-3">
              {[...heats]
                .sort((a, b) => a.Index - b.Index)
                .map((heat) => {
                  const heatAllocs = sortAllocs(heat.Allocations);
                  const heatHasResults = heat.Allocations.some((a) => a.Result);
                  return (
                    <div key={heat.Index}>
                      <div className="mb-1 flex items-center justify-between px-1">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Erä {heat.Index}
                        </p>
                        {heatHasResults && (
                          <span className="text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                            Tulokset
                          </span>
                        )}
                      </div>
                      <ol className="space-y-1">
                        {heatAllocs.map((a) => (
                          <AllocationRow
                            key={a.AllocId}
                            a={a}
                            round={round}
                            showRank={heatHasResults ? "result" : "position"}
                          />
                        ))}
                      </ol>
                    </div>
                  );
                })}
            </div>
          ) : (
            <ol className="space-y-1">
              {flatSorted.map((a) => (
                <AllocationRow
                  key={a.AllocId}
                  a={a}
                  round={round}
                  showRank={hasResults ? "result" : "position"}
                />
              ))}
            </ol>
          )}
          {onDismiss && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={onDismiss}
                className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
              >
                Merkitse luetuksi
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
