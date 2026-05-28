import { queryOptions } from "@tanstack/react-query";
import {
  fetchRounds,
  fetchEvent,
  fetchProperties,
  type Round,
  type RoundsByDate,
  type Allocation,
  type EventResults,
} from "./tuloslista";
import { captureBaselines, loadBaselines } from "./record-baseline";

export interface IndexedEntry {
  round: Round;
  alloc: Allocation;
  heatIndex: number;
  heatBegin: string;
  /** True when this entry is synthesized from Enrollments (no heat allocation yet). */
  fromEnrollment?: boolean;
}

export interface CompetitionIndex {
  name: string;
  entries: IndexedEntry[];
}

export interface CompetitionSchedule {
  rounds: RoundsByDate;
  name: string;
}

export const competitionIndexKey = (id: number) =>
  ["competition-index", id] as const;
export const competitionScheduleKey = (id: number) =>
  ["competition-schedule", id] as const;
export const eventDetailsKey = (id: number, eventId: number) =>
  ["event-details", id, eventId] as const;

/**
 * Heavy query: walks the entire competition's events to build a flat list of
 * (round + allocation) entries used by the watch / search views.
 */
export function competitionIndexQueryOptions(
  competitionId: number,
  onProgress?: (done: number, total: number) => void,
) {
  return queryOptions({
    queryKey: competitionIndexKey(competitionId),
    queryFn: async (): Promise<CompetitionIndex> => {
      const [byDate, props] = await Promise.all([
        fetchRounds(competitionId),
        fetchProperties(competitionId).catch(() => null),
      ]);
      const allRounds: Round[] = Object.values(byDate).flat();
      const eventIds = Array.from(new Set(allRounds.map((r) => r.EventId)));
      onProgress?.(0, eventIds.length);

      const collected: IndexedEntry[] = [];
      const CONCURRENCY = 6;
      let cursor = 0;
      let done = 0;

      const worker = async () => {
        while (cursor < eventIds.length) {
          const i = cursor++;
          const eid = eventIds[i];
          try {
            const ev = await fetchEvent(competitionId, eid);
            const allAllocs = ev.Rounds.flatMap((r) =>
              r.Heats.flatMap((h) => h.Allocations),
            );
            await captureBaselines(competitionId, eid, allAllocs);
            await loadBaselines(competitionId, eid);
            for (const round of ev.Rounds) {
              const matchingRound =
                allRounds.find((r) => r.Id === round.Id) ?? {
                  ...allRounds.find((r) => r.EventId === eid)!,
                  Id: round.Id,
                  BeginDateTimeWithTZ: round.BeginDateTimeWithTZ,
                  Name: round.Name,
                  Status: round.Status,
                };
              const roundHasAllocs = round.Heats.some(
                (h) => h.Allocations.length > 0,
              );
              if (roundHasAllocs) {
                for (const heat of round.Heats) {
                  for (const alloc of heat.Allocations) {
                    collected.push({
                      round: matchingRound,
                      alloc,
                      heatIndex: heat.Index,
                      heatBegin: round.BeginDateTimeWithTZ,
                    });
                  }
                }
              } else if (ev.Enrollments && ev.Enrollments.length > 0) {
                // No heat allocations yet — synthesize entries from enrollments
                // so watched athletes still see the event in their schedule.
                for (const e of ev.Enrollments) {
                  if (e.NotInCompetition) continue;
                  collected.push({
                    round: matchingRound,
                    alloc: {
                      Id: e.Id,
                      AllocId: e.Id,
                      Position: 0,
                      Number: e.Number,
                      TeamName: "",
                      Name: e.Name,
                      Firstname: e.Firstname,
                      Surname: e.Surname,
                      NotInCompetition: false,
                      PB: e.PB ?? "",
                      SB: e.SB ?? "",
                      Result: null,
                      ResultRank: null,
                      HeatRank: null,
                      Wind: null,
                      Organization: e.Organization,
                    },
                    heatIndex: 0,
                    heatBegin: round.BeginDateTimeWithTZ,
                    fromEnrollment: true,
                  });
                }
              }
            }
          } catch {
            /* skip */
          } finally {
            done++;
            onProgress?.(done, eventIds.length);
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      return { name: props?.Competition?.Name ?? "", entries: collected };
    },
    staleTime: 10_000,
    gcTime: 10 * 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Lightweight schedule (rounds by date) + competition name. Used by announcer.
 */
export function competitionScheduleQueryOptions(competitionId: number) {
  return queryOptions({
    queryKey: competitionScheduleKey(competitionId),
    queryFn: async (): Promise<CompetitionSchedule> => {
      const [r, p] = await Promise.all([
        fetchRounds(competitionId),
        fetchProperties(competitionId).catch(() => null),
      ]);
      return { rounds: r, name: p?.Competition?.Name ?? "" };
    },
    staleTime: 0,
    gcTime: 10 * 60_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  });
}

/**
 * Per-event details + baseline capture. Shared by announcer (per wanted event)
 * and the round result page so navigating between them hits the cache.
 */
export function eventDetailsQueryOptions(
  competitionId: number,
  eventId: number,
) {
  return queryOptions({
    queryKey: eventDetailsKey(competitionId, eventId),
    queryFn: async (): Promise<EventResults> => {
      const ev = await fetchEvent(competitionId, eventId);
      const allocs = ev.Rounds.flatMap((r) =>
        r.Heats.flatMap((h) => h.Allocations),
      );
      await captureBaselines(competitionId, eventId, allocs);
      await loadBaselines(competitionId, eventId);
      return ev;
    },
    staleTime: 0,
    gcTime: 10 * 60_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
    enabled: Number.isFinite(eventId) && eventId > 0,
  });
}
