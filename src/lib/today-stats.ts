// Aggregated "today" counters for the home-page hero stats panel.
// Competition count comes from the live competition list; events/athletes/PBs
// from harvested athlete_results.

import { supabase } from "@/integrations/supabase/client";
import { helsinkiDayBounds } from "./daily-best";
import { isLowerBetter } from "./athlete-history";
import { normalizeEventName } from "./season-leaders";
import { pbEventKey } from "./pb-key";
import { seasonRange } from "./season-stats";
import { isRoadOrCrossCountry, isRoadOrCrossCountryRound } from "./event-filters";
import { fetchCompetitionList, filterRunningToday } from "./competition-list";
import { fetchRounds, helsinkiDateKey } from "./tuloslista";

export interface TodayStats {
  competitions: number;
  events: number;
  athletes: number;
  pbs: number;
  seasonTops: number;
}

const PAGE = 1000;

interface TodayRow {
  competition_id: number;
  event_id: number;
  athlete_key: string;
  event_name: string;
  event_category: string;
  sub_category: string;
  age_class: string;
  result_numeric: number | null;
  was_pb: boolean | null;
}

async function fetchTodayRows(): Promise<TodayRow[]> {
  const { startISO, endISO } = helsinkiDayBounds(new Date());
  const out: TodayRow[] = [];
  let offset = 0;
  // Hard cap to keep this lightweight.
  const HARD_CAP = 20_000;
  while (true) {
    const { data, error } = await supabase
      .from("athlete_results")
      .select(
        "competition_id, event_id, athlete_key, event_name, event_category, sub_category, age_class, result_numeric, was_pb",
      )
      .gte("captured_at", startISO)
      .lt("captured_at", endISO)
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const rows = ((data ?? []) as TodayRow[]).filter((r) => !isRoadOrCrossCountry(r));
    out.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
    if (out.length >= HARD_CAP) break;
  }
  return out;
}

interface PriorRow {
  event_name: string;
  age_class: string;
  event_category: string;
  sub_category: string;
  result_numeric: number | null;
}

/** Fetch season rows BEFORE today for the given normalized events + age classes. */
async function fetchSeasonPriorBests(
  eventNames: string[],
  ageClasses: string[],
): Promise<Map<string, number>> {
  const best = new Map<string, number>();
  if (eventNames.length === 0 || ageClasses.length === 0) return best;
  const { from, to } = seasonRange("year");
  const { startISO } = helsinkiDayBounds(new Date());
  // upper bound = min(season end, today start)
  const upper =
    new Date(startISO) < to ? new Date(startISO).toISOString() : to.toISOString();

  let offset = 0;
  const HARD_CAP = 60_000;
  while (true) {
    const { data, error } = await supabase
      .from("athlete_results")
      .select("event_name, age_class, event_category, sub_category, result_numeric")
      .in("event_name", eventNames)
      .in("age_class", ageClasses)
      .gte("competition_date", from.toISOString())
      .lt("competition_date", upper)
      .not("result_numeric", "is", null)
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const rows = ((data ?? []) as PriorRow[]).filter((r) => !isRoadOrCrossCountry(r));
    for (const r of rows) {
      if (r.result_numeric == null) continue;
      const key = `${normalizeEventName(r.event_name)}|${r.age_class}`;
      const lower = isLowerBetter(r.event_category, r.sub_category);
      const cur = best.get(key);
      if (cur == null || (lower ? r.result_numeric < cur : r.result_numeric > cur)) {
        best.set(key, r.result_numeric);
      }
    }
    if (rows.length < PAGE) break;
    offset += PAGE;
    if (offset >= HARD_CAP) break;
  }
  return best;
}

// Aiemmin haettiin koko historian PB:t asiakaspuolella (raskas ja hidas isoilla
// kilpailupäivillä, aiheutti kymmeniä tuhansia rivejä hakevia sivutuksia).
// Käytetään nyt palvelinpuolella laskettua `was_pb`-lippua suoraan.


export async function fetchTodayStats(): Promise<TodayStats> {
  const [today, compList] = await Promise.all([
    fetchTodayRows(),
    fetchCompetitionList().catch(() => [] as Awaited<ReturnType<typeof fetchCompetitionList>>),
  ]);

  // Kisat: elävältä kisalistalta, mukana myös monipäiväisten kisojen
  // jatkopäivät (esim. Jymy Games 11.–12.7.).
  const todayComps = await filterRunningToday(compList).catch(
    () => [] as Awaited<ReturnType<typeof filterRunningToday>>,
  );
  const liveTodayCount = todayComps.length;

  // Hae kierrokset jokaiselle tänään pidettävälle kisalle (rinnakkain).
  const todayKey = helsinkiDateKey(new Date().toISOString());
  const roundsByComp = await Promise.all(
    todayComps.map((c) =>
      fetchRounds(c.Id)
        .then((rbd) => ({ id: c.Id, rounds: rbd[todayKey] ?? [] }))
        .catch(() => ({ id: c.Id, rounds: [] as Awaited<ReturnType<typeof fetchRounds>>[string] })),
    ),
  );


  const events = new Set<string>();
  const athletes = new Set<string>();
  for (const r of today) {
    events.add(`${r.competition_id}|${r.event_id}`);
    athletes.add(r.athlete_key);
  }

  // Lajit ja ilmoittautumiset eläväs­tä kierros­datasta (ennen tuloksia).
  let enrolledSum = 0;
  for (const { id, rounds } of roundsByComp) {
    const seenEventIds = new Set<number>();
    for (const r of rounds) {
      if (isRoadOrCrossCountryRound(r)) continue;
      if (!seenEventIds.has(r.EventId)) {
        seenEventIds.add(r.EventId);
        enrolledSum += r.CountEnrolled ?? 0;
      }
      events.add(`${id}|${r.EventId}`);
    }
  }
  const athletesCount = Math.max(athletes.size, enrolledSum);




  const rawEventNames = Array.from(
    new Set(
      today
        .filter((r) => r.result_numeric != null && r.athlete_key)
        .map((r) => r.event_name),
    ),
  );

  // PB-lippu tulee suoraan riviltä (palvelinpuolen laskenta upsertin
  // yhteydessä). Yhteen (urheilija, laji) -pariin lasketaan enintään yksi PB.
  const pbSeen = new Set<string>();
  for (const r of today) {
    if (!r.was_pb) continue;
    if (!r.athlete_key) continue;
    const key = `${r.athlete_key}|${pbEventKey({ event_name: r.event_name, age_class: r.age_class })}`;
    pbSeen.add(key);
  }
  const pbs = pbSeen.size;


  // Season tops: per (normalized event, age_class), tämän päivän paras vs kauden aiempi.
  const todayBest = new Map<
    string,
    { numeric: number; eventCategory: string; subCategory: string; eventName: string; ageClass: string }
  >();
  for (const r of today) {
    if (r.result_numeric == null) continue;
    if (!r.age_class) continue;
    const norm = normalizeEventName(r.event_name);
    const key = `${norm}|${r.age_class}`;
    const lower = isLowerBetter(r.event_category, r.sub_category);
    const cur = todayBest.get(key);
    if (
      !cur ||
      (lower ? r.result_numeric < cur.numeric : r.result_numeric > cur.numeric)
    ) {
      todayBest.set(key, {
        numeric: r.result_numeric,
        eventCategory: r.event_category,
        subCategory: r.sub_category,
        eventName: r.event_name,
        ageClass: r.age_class,
      });
    }
  }

  const ageClassList = Array.from(
    new Set(today.map((r) => r.age_class).filter(Boolean) as string[]),
  );
  const priorBest = await fetchSeasonPriorBests(rawEventNames, ageClassList);

  let seasonTops = 0;
  for (const [key, t] of todayBest) {
    const prior = priorBest.get(key);
    const lower = isLowerBetter(t.eventCategory, t.subCategory);
    if (prior == null) {
      seasonTops++;
      continue;
    }
    if (lower ? t.numeric < prior : t.numeric > prior) seasonTops++;
  }

  // Jos kisalista epäonnistui, fallback: athlete_results-distinct comp_id.
  const compsFallback = new Set(today.map((r) => r.competition_id)).size;
  const competitions = liveTodayCount > 0 ? liveTodayCount : compsFallback;

  return {
    competitions,
    events: events.size,
    athletes: athletesCount,
    pbs,
    seasonTops,
  };
}
