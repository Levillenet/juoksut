import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { detectRecord } from "@/lib/records";
import { effectiveRecord } from "@/lib/record-baseline";
import { useHistoryBaseline } from "@/lib/history-baseline";
import { athleteKey } from "@/lib/athlete-key";
import { helsinkiDateKey, type Round, type EventResults } from "@/lib/tuloslista";
import {
  competitionScheduleQueryOptions,
  competitionScheduleKey,
  eventDetailsQueryOptions,
} from "@/lib/tuloslista-queries";
import { useCompetitionId } from "@/lib/competition-store";

export interface RecordAlert {
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

export type DetailCache = { [k: number]: EventResults };

const MAX_RECORDS = 50;

export function useAnnouncerData() {
  const [competitionId] = useCompetitionId();
  const queryClient = useQueryClient();
  const [now, setNow] = useState<Date | null>(null);
  const [showRunning, setShowRunning] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showPastUpcoming, setShowPastUpcoming] = useState(false);
  const [recordAlerts, setRecordAlerts] = useState<RecordAlert[]>([]);
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
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        q.queryKey[0] === "event-details" &&
        q.queryKey[1] === competitionId,
    });
  };

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  useHistoryBaseline(competitionId);

  const todayKey = helsinkiDateKey((now ?? new Date()).toISOString());
  const todayRounds = useMemo<Round[]>(() => {
    if (!data) return [];
    return [...(data[todayKey] ?? [])].sort((a, b) =>
      a.BeginDateTimeWithTZ.localeCompare(b.BeginDateTimeWithTZ),
    );
  }, [data, todayKey]);

  const scheduleInProgress = todayRounds.filter((r) => r.Status === "Progress");
  const scheduleCompleted = todayRounds.filter((r) => r.Status === "Official");

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
  const upcomingFiltered = showPastUpcoming
    ? upcomingAll
    : upcomingAll.filter(
        (r) => new Date(r.BeginDateTimeWithTZ).getTime() > nowMs - 5 * 60_000,
      );
  const pastUpcomingCount = upcomingAll.length - upcomingFiltered.length;

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

  const finishedProgressRoundIds = useMemo(() => {
    const s = new Set<number>();
    for (const r of inProgressAll) {
      if (r.Category !== "Track") continue;
      const ev = details[r.EventId];
      if (!ev) continue;
      const round = ev.Rounds.find((rr) => rr.Id === r.Id);
      if (!round) continue;
      if (round.Status === "Official") s.add(r.Id);
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details, JSON.stringify(inProgressAll.map((r) => r.Id))]);

  const inProgressVisible = inProgress.filter(
    (r) => !finishedProgressRoundIds.has(r.Id),
  );
  const completedAllMerged = useMemo(() => {
    const extra = inProgressAll.filter((r) => finishedProgressRoundIds.has(r.Id));
    const seen = new Set<number>();
    const all = [...completedAll, ...extra].filter((r) => {
      if (seen.has(r.Id)) return false;
      seen.add(r.Id);
      return true;
    });
    return all.sort((a, b) =>
      b.BeginDateTimeWithTZ.localeCompare(a.BeginDateTimeWithTZ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedAll, inProgressAll, finishedProgressRoundIds]);
  const completedVisible = completedAllMerged.filter(
    (r) => !dismissedCompletedIds.has(r.Id),
  );

  useEffect(() => {
    const seen = seenResultsRef.current;
    const fresh: RecordAlert[] = [];
    Object.values(details).forEach((ev) => {
      ev.Rounds.forEach((round) => {
        round.Heats.forEach((heat) => {
          heat.Allocations.forEach((a) => {
            if (!a.Result || a.NotInCompetition) return;
            const prevResult = seen.get(a.AllocId);
            seen.set(a.AllocId, a.Result);
            if (prevResult === a.Result) return;
            const eff = effectiveRecord(ev.Id, a, {
              competitionId,
              athleteKey: athleteKey(a.Surname, a.Firstname, a.Organization?.Id ?? null),
              eventName: ev.Name,
            });
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

  return {
    competitionId,
    name,
    todayKey,
    now,
    updatedAt,
    manualLoading,
    reload,
    inProgressVisible,
    completedAllMerged,
    completedVisible,
    upcomingAll,
    upcomingFiltered,
    pastUpcomingCount,
    showRunning,
    setShowRunning,
    showPastUpcoming,
    setShowPastUpcoming,
    expanded,
    toggleExpand,
    recordAlerts,
    filteredRecords,
    includeSB,
    setIncludeSB,
    clearRecords,
    details,
    dismissedCompletedIds,
    dismissCompleted,
    restoreDismissed,
  };
}

export type AnnouncerData = ReturnType<typeof useAnnouncerData>;
