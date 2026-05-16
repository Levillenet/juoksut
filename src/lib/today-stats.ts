// Aggregated "today" counters for the home-page hero stats panel.
// All data comes from the harvested athlete_results table; no scraping here.

import { supabase } from "@/integrations/supabase/client";
import { helsinkiDayBounds } from "./daily-best";
import { isLowerBetter } from "./athlete-history";
import { normalizeEventName } from "./season-leaders";
import { seasonRange } from "./season-stats";

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
    const rows = (data ?? []) as TodayRow[];
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
    const rows = (data ?? []) as PriorRow[];
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

export async function fetchTodayStats(): Promise<TodayStats> {
  const today = await fetchTodayRows();

  const comps = new Set<number>();
  const events = new Set<string>();
  const athletes = new Set<string>();
  let pbs = 0;
  for (const r of today) {
    comps.add(r.competition_id);
    events.add(`${r.competition_id}|${r.event_id}`);
    athletes.add(r.athlete_key);
    if (r.was_pb) pbs++;
  }

  // Season tops set today: per (normalized event, age_class), find today's best
  // and compare to the best in the rest of the current season.
  const todayBest = new Map<
    string,
    { numeric: number; eventCategory: string; eventName: string; ageClass: string }
  >();
  for (const r of today) {
    if (r.result_numeric == null) continue;
    if (!r.age_class) continue;
    const norm = normalizeEventName(r.event_name);
    const key = `${norm}|${r.age_class}`;
    const lower = isLowerBetter(r.event_category);
    const cur = todayBest.get(key);
    if (
      !cur ||
      (lower ? r.result_numeric < cur.numeric : r.result_numeric > cur.numeric)
    ) {
      todayBest.set(key, {
        numeric: r.result_numeric,
        eventCategory: r.event_category,
        eventName: r.event_name,
        ageClass: r.age_class,
      });
    }
  }

  // For the prior-season query we need raw event_name values that match what's
  // in DB. Pull the raw names that contributed to todayBest.
  const rawEventNames = Array.from(
    new Set(
      today
        .filter((r) => r.result_numeric != null && r.age_class)
        .map((r) => r.event_name),
    ),
  );
  // Also include all season variants of the same normalized name — handled by
  // grouping on normalized name client-side. We still query by raw names that
  // we know about (today's set); season tops by definition compete with rows
  // recorded under the same event_name family during the same season.
  const ageClassList = Array.from(
    new Set(today.map((r) => r.age_class).filter(Boolean) as string[]),
  );
  const priorBest = await fetchSeasonPriorBests(rawEventNames, ageClassList);

  let seasonTops = 0;
  for (const [key, t] of todayBest) {
    const prior = priorBest.get(key);
    const lower = isLowerBetter(t.eventCategory);
    if (prior == null) {
      seasonTops++;
      continue;
    }
    if (lower ? t.numeric < prior : t.numeric > prior) seasonTops++;
  }

  return {
    competitions: comps.size,
    events: events.size,
    athletes: athletes.size,
    pbs,
    seasonTops,
  };
}
