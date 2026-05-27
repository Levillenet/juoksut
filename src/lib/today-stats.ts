// Aggregated "today" counters for the home-page hero stats panel.
// Competition count comes from the live competition list; events/athletes/PBs
// from harvested athlete_results.

import { supabase } from "@/integrations/supabase/client";
import { helsinkiDayBounds } from "./daily-best";
import { isLowerBetter } from "./athlete-history";
import { normalizeEventName } from "./season-leaders";
import { seasonRange } from "./season-stats";
import { isRoadOrCrossCountry } from "./event-filters";
import { fetchCompetitionList, filterToday } from "./competition-list";

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
      .gte("competition_date", startISO)
      .lt("competition_date", endISO)
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

/** Fetch all-time best (before today) for given (athlete_key, event_name) candidates. */
async function fetchAllTimePriorBests(
  eventNames: string[],
  athleteKeys: string[],
): Promise<Map<string, number>> {
  const best = new Map<string, number>();
  if (eventNames.length === 0 || athleteKeys.length === 0) return best;
  const { startISO } = helsinkiDayBounds(new Date());

  const KEY_CHUNK = 200;
  for (let i = 0; i < athleteKeys.length; i += KEY_CHUNK) {
    const keysSlice = athleteKeys.slice(i, i + KEY_CHUNK);
    let offset = 0;
    const HARD_CAP = 60_000;
    while (true) {
      const { data, error } = await supabase
        .from("athlete_results")
        .select(
          "athlete_key, event_name, event_category, sub_category, result_numeric",
        )
        .in("athlete_key", keysSlice)
        .in("event_name", eventNames)
        .lt("competition_date", startISO)
        .not("result_numeric", "is", null)
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        athlete_key: string;
        event_name: string;
        event_category: string;
        sub_category: string;
        result_numeric: number | null;
      }>;
      const filtered = rows.filter((r) => !isRoadOrCrossCountry(r));
      for (const r of filtered) {
        if (r.result_numeric == null) continue;
        const key = `${r.athlete_key}|${normalizeEventName(r.event_name)}`;
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
  }
  return best;
}

export async function fetchTodayStats(): Promise<TodayStats> {
  const [today, compList] = await Promise.all([
    fetchTodayRows(),
    fetchCompetitionList().catch(() => [] as Awaited<ReturnType<typeof fetchCompetitionList>>),
  ]);

  // Kisat: elävältä kisalistalta (mukana myös ne joista ei vielä tuloksia).
  const liveTodayCount = filterToday(compList).length;

  const events = new Set<string>();
  const athletes = new Set<string>();
  for (const r of today) {
    events.add(`${r.competition_id}|${r.event_id}`);
    athletes.add(r.athlete_key);
  }

  // Per (athlete, normalized event) tämän päivän paras tulos.
  type Best = {
    numeric: number;
    eventCategory: string;
    subCategory: string;
    eventName: string;
    ageClass: string;
    athleteKey: string;
  };
  const todayAthleteBest = new Map<string, Best>();
  for (const r of today) {
    if (r.result_numeric == null) continue;
    if (!r.athlete_key) continue;
    const norm = normalizeEventName(r.event_name);
    const key = `${r.athlete_key}|${norm}`;
    const lower = isLowerBetter(r.event_category, r.sub_category);
    const cur = todayAthleteBest.get(key);
    if (
      !cur ||
      (lower ? r.result_numeric < cur.numeric : r.result_numeric > cur.numeric)
    ) {
      todayAthleteBest.set(key, {
        numeric: r.result_numeric,
        eventCategory: r.event_category,
        subCategory: r.sub_category,
        eventName: r.event_name,
        ageClass: r.age_class,
        athleteKey: r.athlete_key,
      });
    }
  }

  const rawEventNames = Array.from(
    new Set(
      today
        .filter((r) => r.result_numeric != null && r.athlete_key)
        .map((r) => r.event_name),
    ),
  );
  const athleteKeyList = Array.from(
    new Set(Array.from(todayAthleteBest.values()).map((b) => b.athleteKey)),
  );

  // PBs lasketaan client-puolella koko historiasta (was_pb voi olla viiveellä).
  const priorAllTime = await fetchAllTimePriorBests(rawEventNames, athleteKeyList);

  let pbs = 0;
  for (const [key, t] of todayAthleteBest) {
    const prior = priorAllTime.get(key);
    const lower = isLowerBetter(t.eventCategory, t.subCategory);
    if (prior == null) {
      pbs++;
      continue;
    }
    if (lower ? t.numeric < prior : t.numeric > prior) pbs++;
  }

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
    athletes: athletes.size,
    pbs,
    seasonTops,
  };
}
