import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import { detectRecord, RecordBadge } from "@/lib/records";
import { effectiveRecord } from "@/lib/record-baseline";
import { athleteKey } from "@/lib/athlete-key";
import { useCompetitionId } from "@/lib/competition-store";
import { ConfirmedDot } from "@/components/ConfirmedDot";
import {
  formatRelayLegs,
  formatTime,
  isHeatRound,
  type Round,
  type Allocation,
  type EventResults,
} from "@/lib/tuloslista";


export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function SectionTitle({
  icon,
  title,
  count,
}: {
  icon: ReactNode;
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

export function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

export function flattenAllocations(detail?: EventResults): Allocation[] {
  if (!detail) return [];
  const all: Allocation[] = [];
  detail.Rounds.forEach((rd) => rd.Heats.forEach((h) => all.push(...h.Allocations)));
  return all;
}

export function rankedTop(detail: EventResults | undefined, n: number): Allocation[] {
  return flattenAllocations(detail)
    .filter((a) => !a.NotInCompetition && (a.ResultRank != null || a.Result))
    .sort((a, b) => (a.ResultRank ?? 999) - (b.ResultRank ?? 999))
    .slice(0, n);
}

export function EventCard({
  round,
  detail,
  live = false,
  open = false,
  onToggle,
  rankLimit = 10,
}: {
  round: Round;
  detail?: EventResults;
  live?: boolean;
  open?: boolean;
  onToggle?: () => void;
  /** When open, cap the number of ranked rows shown. */
  rankLimit?: 5 | 10;
}) {
  const [competitionId] = useCompetitionId();
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
  const openList = allRanked.slice(0, rankLimit);
  const list = open ? openList : top3;

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

  // FLIP animation: smoothly slide rows when their position in the list changes.
  const rowRefs = useRef<Map<number, HTMLLIElement>>(new Map());
  const prevRectsRef = useRef<Map<number, number>>(new Map());
  const [flashWinnerId, setFlashWinnerId] = useState<number | null>(null);
  const prevTopIdRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!live) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const prev = prevRectsRef.current;
    const next = new Map<number, number>();
    const animations: Array<{ el: HTMLLIElement; delta: number; isWinner: boolean }> = [];

    // Determine new leader id (rank 1).
    const newLeader = list.find(
      (a) => (a.ResultRank ?? (round.Category === "Track" ? null : a.Position)) === 1,
    );
    const newLeaderId = newLeader?.AllocId ?? null;
    const leaderChanged =
      newLeaderId != null &&
      prevTopIdRef.current != null &&
      prevTopIdRef.current !== newLeaderId;

    for (const a of list) {
      const el = rowRefs.current.get(a.AllocId);
      if (!el) continue;
      const top = el.getBoundingClientRect().top;
      next.set(a.AllocId, top);
      const before = prev.get(a.AllocId);
      if (before != null && before !== top) {
        const delta = before - top;
        animations.push({
          el,
          delta,
          isWinner: leaderChanged && a.AllocId === newLeaderId,
        });
      }
    }

    prevRectsRef.current = next;
    if (newLeaderId != null) prevTopIdRef.current = newLeaderId;

    if (prefersReduced || animations.length === 0) return;

    for (const { el, delta, isWinner } of animations) {
      const keyframes = isWinner
        ? [
            { transform: `translateY(${delta}px) scale(1)` },
            { transform: `translateY(0) scale(1.03)`, offset: 0.6 },
            { transform: `translateY(0) scale(1)` },
          ]
        : [
            { transform: `translateY(${delta}px)` },
            { transform: `translateY(0)` },
          ];
      el.animate(keyframes, {
        duration: isWinner ? 750 : 550,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both",
      });
    }

    if (leaderChanged && newLeaderId != null) {
      setFlashWinnerId(newLeaderId);
      const t = window.setTimeout(() => setFlashWinnerId(null), 1600);
      return () => window.clearTimeout(t);
    }
  }, [list, live, round.Category]);

  const heatMode = isHeatRound(round);
  const matchingRound = useMemo(
    () => detail?.Rounds.find((r) => r.Id === round.Id) ?? detail?.Rounds[0],
    [detail, round.Id],
  );
  const heats = matchingRound?.Heats ?? [];

  if (heatMode) {
    const sortedHeats = [...heats].sort((a, b) => a.Index - b.Index);
    return (
      <div
        data-event-id={round.EventId}
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
            <p className="truncate text-xs text-muted-foreground">{round.Name}</p>
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
          {!detail ? (
            <p className="rounded-lg bg-muted/50 px-3 py-4 text-center text-xs text-muted-foreground">
              Ladataan tuloksia…
            </p>
          ) : sortedHeats.length === 0 ? (
            <p className="rounded-lg bg-muted/50 px-3 py-4 text-center text-xs text-muted-foreground">
              Eriä ei vielä julkaistu.
            </p>
          ) : !open ? (
            <ul className="space-y-1">
              {sortedHeats.map((heat) => {
                const total = heat.Allocations.filter((a) => !a.NotInCompetition).length;
                const done = heat.Allocations.filter(
                  (a) => !a.NotInCompetition && a.Result,
                ).length;
                const allDone = total > 0 && done === total;
                return (
                  <li
                    key={heat.Index}
                    className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs"
                  >
                    <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                      Erä {heat.Index}
                    </span>
                    <span
                      className={`tabular-nums font-semibold ${
                        allDone
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {done}/{total} tulosta
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="space-y-3">
              {sortedHeats.map((heat) => {
                const heatHasResults = heat.Allocations.some((a) => a.Result);
                const heatAllocs = [...heat.Allocations].sort((a, b) => {
                  if (heatHasResults) {
                    return (a.HeatRank ?? 999) - (b.HeatRank ?? 999);
                  }
                  return (a.Position ?? 999) - (b.Position ?? 999);
                });
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
                          showRank={heatHasResults ? "heat" : "position"}
                        />
                      ))}
                    </ol>

                  </div>
                );
              })}
            </div>
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



  return (
    <div
      data-event-id={round.EventId}
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
          <p className="truncate text-xs text-muted-foreground">{round.Name}</p>
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
              const isTrack = round.Category === "Track";
              const rank = a.ResultRank ?? (isTrack ? null : a.Position);
              const badgeValue = isTrack ? a.Position : rank;
              const change = rankChanges.get(a.AllocId);
              const eff = a.Result
                ? effectiveRecord(round.EventId, a, {
                    competitionId,
                    athleteKey: athleteKey(a.Surname, a.Firstname, a.Organization?.Id ?? null),
                    eventName: round.EventName,
                  })
                : null;
              const recordKind =
                a.Result && eff
                  ? detectRecord(round.Category, a.Result, eff.pb, eff.sb)
                  : null;
              return (
                <li
                  key={a.AllocId}
                  ref={(el) => {
                    if (el) rowRefs.current.set(a.AllocId, el);
                    else rowRefs.current.delete(a.AllocId);
                  }}
                  className={`grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-2 rounded-lg bg-muted/40 px-3 py-2 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:gap-x-3 ${
                    flashWinnerId === a.AllocId
                      ? "ring-2 ring-primary/70 shadow-lg shadow-primary/20 transition-shadow"
                      : "transition-shadow"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-full font-black tabular-nums leading-none ${
                      rank === 1
                        ? "bg-primary text-primary-foreground"
                        : rank === 2
                          ? "bg-accent text-accent-foreground"
                          : "bg-secondary text-secondary-foreground"
                    }`}
                    title={isTrack ? `Rata ${a.Position}` : undefined}
                  >
                    {isTrack && (
                      <span className="text-[8px] font-semibold uppercase tracking-wide opacity-70">
                        Rata
                      </span>
                    )}
                    <span className="text-sm">{badgeValue ?? "–"}</span>
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
                    <div className="flex items-center gap-1.5">
                      {isTrack && a.Number && (
                        <span
                          className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-primary"
                          title="Rintanumero"
                        >
                          #{a.Number}
                        </span>
                      )}
                      <p className="truncate text-sm font-semibold leading-tight">
                        {a.Name}
                        {!a.Result && (
                          <ConfirmedDot confirmed={a.Confirmed} className="ml-1.5 align-middle" />
                        )}
                      </p>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.Organization?.Name ?? a.Organization?.NameShort ?? ""}
                    </p>
                    {(() => {
                      const legs = formatRelayLegs(a);
                      return legs ? (
                        <p className="truncate text-xs text-muted-foreground">{legs}</p>
                      ) : null;
                    })()}
                  </div>
                  <div className="col-start-3 col-end-4 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 sm:col-start-4 sm:col-end-5 sm:mt-0 sm:shrink-0 sm:justify-end">
                    {a.Result ? (
                      <>
                        {isTrack && a.ResultRank != null && (
                          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                            {a.ResultRank}.
                          </span>
                        )}
                        <span className="text-base font-bold tabular-nums">{a.Result}</span>
                      </>
                    ) : (
                      <span className="flex gap-2 text-xs text-muted-foreground">
                        {a.SB && <span title="Kauden ennätys">SB {a.SB}</span>}
                        {a.PB && <span title="Oma ennätys">PB {a.PB}</span>}
                      </span>
                    )}
                    {round.Category === "Field" && !a.NotInCompetition && (() => {
                      const done = a.Attempts?.length ?? 0;
                      if (done === 0) return null;
                      const isVertical =
                        round.SubCategory === "HighJump" ||
                        round.SubCategory === "PoleVault";
                      const label = isVertical
                        ? `${done} yrit.`
                        : done >= 6
                          ? `${done}`
                          : `${done}/6`;
                      return (
                        <span
                          className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground"
                          title="Tehdyt suoritukset"
                        >
                          {label}
                        </span>
                      );
                    })()}
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
  showRank: "result" | "position" | "heat";
}) {
  const [competitionId] = useCompetitionId();
  const rank =
    showRank === "result"
      ? a.ResultRank
      : showRank === "heat"
        ? a.HeatRank
        : a.Position;

  const eff = a.Result
    ? effectiveRecord(round.EventId, a, {
        competitionId,
        athleteKey: athleteKey(a.Surname, a.Firstname, a.Organization?.Id ?? null),
        eventName: round.EventName,
      })
    : null;
  const recordKind =
    a.Result && eff ? detectRecord(round.Category, a.Result, eff.pb, eff.sb) : null;
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
            <span className="block truncate">
              {a.Name}
              {!a.Result && (
                <ConfirmedDot confirmed={a.Confirmed} className="ml-1.5 align-middle" />
              )}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {a.Organization?.Name ?? ""}
            </span>
            {(() => {
              const legs = formatRelayLegs(a);
              return legs ? (
                <span className="block truncate text-xs text-muted-foreground">{legs}</span>
              ) : null;
            })()}
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

export function UpcomingItem({
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
  const matchingRound = useMemo(
    () => detail?.Rounds.find((r) => r.Id === round.Id) ?? detail?.Rounds[0],
    [detail, round.Id],
  );
  const heats = matchingRound?.Heats ?? [];
  const allocations = useMemo(() => heats.flatMap((h) => h.Allocations), [heats]);
  const hasResults = allocations.some((a) => a.Result);
  const isTrackHeats = groupHeats && round.Category === "Track" && heats.length > 1;

  const sortAllocs = (list: Allocation[]) => {
    if (hasResults) {
      return [...list].sort((a, b) => (a.ResultRank ?? 999) - (b.ResultRank ?? 999));
    }
    return [...list].sort((a, b) => (a.Position ?? 999) - (b.Position ?? 999));
  };

  const flatSorted = useMemo(
    () => sortAllocs(allocations),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allocations, hasResults],
  );

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
