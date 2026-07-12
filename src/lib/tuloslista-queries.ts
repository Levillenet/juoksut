/**
 * Jaetut live-datan kyselyt (tuloslista.com).
 *
 * SÄÄNNÖT — pidetään yksi totuus, ettei eri näkymät ajaudu eri lopputuloksiin
 * (esim. ilmoittautumiset näkyvät yhdessä mutta eivät toisessa).
 *
 * 1. Urheilijatason / allokaatiotason näkymät (haku, seuranta, tulosteet,
 *    YAG-calling jne.) käyttävät **vain** `competitionIndexQueryOptions`.
 *    Indeksi sisältää automaattisesti `Enrollments`-fallbackin: kun eräjakoa
 *    ei ole vielä tehty, ilmoittautuneet näkyvät `fromEnrollment: true`
 *    -merkinnällä — tämä on miksi huomisen 800 m löytyy haulla vaikka rataa
 *    ei ole vielä jaettu.
 *
 * 2. Aikataulutason näkymät (kotisivun lajilista, tulostettava aikataulu,
 *    juoksulajien operointi, kuuluttajan rounds-jono) käyttävät **vain**
 *    `competitionScheduleQueryOptions`. Älä tee omaa `fetchRounds`-kutsua
 *    + `useState`/`useEffect`-paria komponenttiin: jaettu query antaa
 *    automaattisen 15 s päivityksen ja yhden cache-merkinnän.
 *
 * 3. Yksittäisen lajin yksityiskohdat (tulosrivit, eräjako per laji) tulevat
 *    `eventDetailsQueryOptions`-funktiolta, joka kapseloi `fetchEvent`-haun.
 *    Älä luo uutta `fetchEvent`-looppia komponenttiin — jos tarvitset useita
 *    lajeja, käytä `useQueries` `eventDetailsQueryOptions`-pohjalta.
 *
 * Jos uusi tarve ei mahdu näihin kolmeen, lisää tähän tiedostoon uusi
 * jaettu `queryOptions`-funktio sen sijaan että kirjoittaisit oman fetchin
 * suoraan reittiin.
 */
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
  options?: {
    onProgress?: (done: number, total: number) => void;
    skipBaselines?: boolean;
  },
) {
  const onProgress = options?.onProgress;
  const skipBaselines = options?.skipBaselines ?? false;
  return queryOptions({
    queryKey: [
      ...competitionIndexKey(competitionId),
      skipBaselines ? "no-baselines" : "baselines",
    ] as const,
    queryFn: async (): Promise<CompetitionIndex> => {
      const [byDate, props] = await Promise.all([
        fetchRounds(competitionId),
        fetchProperties(competitionId).catch(() => null),
      ]);
      const allRounds: Round[] = Object.values(byDate).flat();
      const eventIds = Array.from(new Set(allRounds.map((r) => r.EventId)));
      onProgress?.(0, eventIds.length);

      const collected: IndexedEntry[] = [];
      const CONCURRENCY = 12;
      let cursor = 0;
      let done = 0;

      const PER_EVENT_TIMEOUT_MS = 8_000;
      const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
        new Promise<T>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error("event-timeout")), ms);
          p.then(
            (v) => {
              clearTimeout(t);
              resolve(v);
            },
            (e) => {
              clearTimeout(t);
              reject(e);
            },
          );
        });

      const worker = async () => {
        while (cursor < eventIds.length) {
          const i = cursor++;
          const eid = eventIds[i];
          try {
            const ev = await withTimeout(
              fetchEvent(competitionId, eid),
              PER_EVENT_TIMEOUT_MS,
            );
            if (!skipBaselines) {
              const allAllocs = ev.Rounds.flatMap((r) =>
                r.Heats.flatMap((h) => h.Allocations),
              );
              try {
                await captureBaselines(competitionId, eid, allAllocs);
                await loadBaselines(competitionId, eid);
              } catch {
                /* baseline DB is best-effort */
              }
            }
            const eventHasAnyAllocs = ev.Rounds.some((r) =>
              r.Heats.some((h) => h.Allocations.length > 0),
            );
            const firstRoundId = ev.Rounds
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.BeginDateTimeWithTZ).getTime() -
                  new Date(b.BeginDateTimeWithTZ).getTime(),
              )[0]?.Id;
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
              } else if (
                !eventHasAnyAllocs &&
                round.Id === firstRoundId &&
                ev.Enrollments &&
                ev.Enrollments.length > 0
              ) {
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
            /* skip slow/failing event so the page can still render */
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
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
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
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
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
      // Rikasta allokaatiot Confirmed-tiedolla Enrollments-listasta:
      // osassa kilpailuista (esim. Kouvola Junior Games) API palauttaa
      // Confirmed-kentän vain ilmoittautumisissa, ei allokaatioissa.
      const enrollments = ev.Enrollments ?? [];
      if (enrollments.length > 0) {
        const byTeamId = new Map<number, boolean>();
        const byNameOrg = new Map<string, boolean>();
        for (const e of enrollments) {
          if (typeof e.Confirmed !== "boolean") continue;
          if (e.TeamId != null) byTeamId.set(e.TeamId, e.Confirmed);
          const nk = `${e.Firstname ?? ""}|${e.Surname ?? ""}|${e.Organization?.Id ?? ""}`;
          byNameOrg.set(nk, e.Confirmed);
        }
        for (const round of ev.Rounds) {
          for (const heat of round.Heats) {
            for (const a of heat.Allocations) {
              if (a.Confirmed === true || a.Confirmed === false) continue;
              let c: boolean | undefined;
              if (a.TeamId != null) c = byTeamId.get(a.TeamId);
              if (c === undefined) {
                const nk = `${a.Firstname ?? ""}|${a.Surname ?? ""}|${a.Organization?.Id ?? ""}`;
                c = byNameOrg.get(nk);
              }
              if (c !== undefined) a.Confirmed = c;
            }
          }
        }
      }
      const allocs = ev.Rounds.flatMap((r) =>
        r.Heats.flatMap((h) => h.Allocations),
      );
      // Fire-and-forget: nämä ovat Supabase-sivutulosteita, jotka rikastavat
      // näyttöä myöhemmin. Emme saa jäädä odottamaan niitä — muuten hidas
      // upsert isolla osallistujamäärällä jättää koko näytön Ladataan-tilaan.
      void captureBaselines(competitionId, eventId, allocs).then(() =>
        loadBaselines(competitionId, eventId),
      );
      return ev;
    },

    staleTime: 0,
    gcTime: 10 * 60_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    enabled: Number.isFinite(eventId) && eventId > 0,
  });
}
