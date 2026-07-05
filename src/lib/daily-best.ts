// Read-only helpers for "today's best" — driven entirely by the
// background-harvested athlete_results table. No client-side fetching of
// tuloslista.com here.

import { supabase } from "@/integrations/supabase/client";
import { isLowerBetter } from "./athlete-history";
import { isRoadOrCrossCountry } from "./event-filters";

export interface DailyBestRow {
  event_name: string;
  sub_category: string;
  event_category: string;
  age_class: string;
  result_text: string;
  result_numeric: number | null;
  result_rank: number | null;
  athlete_key: string;
  surname: string;
  firstname: string;
  organization: string;
  organization_id: number | null;
  competition_name: string;
  competition_id: number;
  competition_date: string | null;
  event_id: number;
  was_pb: boolean | null;
  was_district_record: boolean | null;
}

/** [startISO, endISO) covering the given calendar date in Helsinki TZ. */
export function helsinkiDayBounds(date: Date): { startISO: string; endISO: string } {
  // Format the date in Helsinki to get its Y-M-D, then interpret midnight Helsinki as UTC.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  // Helsinki is UTC+2 (winter) or UTC+3 (summer). Build the local midnight as a
  // string and let JS resolve the offset via Date parsing of the "+HH:MM" form
  // — but we don't know which one. Compute it from the date itself.
  // Trick: compose midnight UTC for that Y-M-D, then subtract the actual TZ offset
  // by formatting the same instant in Helsinki and comparing.
  const utcMidnight = new Date(`${y}-${m}-${d}T00:00:00Z`);
  // Find Helsinki offset minutes for that instant
  const helFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Helsinki",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(utcMidnight);
  const helHour = parseInt(helFmt.find((p) => p.type === "hour")!.value, 10);
  // Offset is the difference between local hour and UTC hour at that instant
  const offsetHours = helHour === 0 ? 0 : helHour; // 2 or 3
  const startISO = new Date(
    utcMidnight.getTime() - offsetHours * 3600_000,
  ).toISOString();
  const endISO = new Date(
    new Date(startISO).getTime() + 24 * 3600_000,
  ).toISOString();
  return { startISO, endISO };
}

/** All age classes seen today (filter chip source). */
export async function fetchTodayAgeClasses(): Promise<string[]> {
  const { startISO, endISO } = helsinkiDayBounds(new Date());
  const { data, error } = await supabase
    .from("athlete_results")
    .select("age_class")
    .gte("captured_at", startISO)
    .lt("captured_at", endISO);
  if (error) throw error;
  const set = new Set<string>();
  for (const r of data ?? []) {
    const v = (r as { age_class: string | null }).age_class;
    if (v) set.add(v);
  }
  return Array.from(set).sort(sortAgeClass);
}

/** Today's best result per (event_name + age_class) for the chosen age classes. */
export async function fetchDailyBest(ageClasses: string[]): Promise<DailyBestRow[]> {
  if (ageClasses.length === 0) return [];
  const { startISO, endISO } = helsinkiDayBounds(new Date());
  const { data, error } = await supabase
    .from("athlete_results")
    .select(
      "event_name, sub_category, event_category, age_class, result_text, result_numeric, result_rank, athlete_key, surname, firstname, organization, organization_id, competition_name, competition_id, competition_date, event_id, was_pb, was_district_record",
    )
    .in("age_class", ageClasses)
    .gte("captured_at", startISO)
    .lt("captured_at", endISO)
    .not("result_numeric", "is", null);
  if (error) throw error;
  const filtered = (data as DailyBestRow[]).filter((r) => !isRoadOrCrossCountry(r));
  return reduceBest(filtered);
}

/**
 * For each given athleteKey, return today's best result of OTHER competitors
 * in the same (event_name + age_class) where the athlete also has a result today.
 * Returns map: athleteKey → DailyBestRow[]
 */
export async function fetchDailyBestForAthletes(
  athleteKeys: string[],
): Promise<Record<string, DailyBestRow[]>> {
  if (athleteKeys.length === 0) return {};
  const { startISO, endISO } = helsinkiDayBounds(new Date());

  // 1. Find which (event_name, age_class) each watched athlete competed in today
  const { data: own, error: e1 } = await supabase
    .from("athlete_results")
    .select(
      "athlete_key, event_name, age_class, sub_category, event_category, result_text, result_numeric",
    )
    .in("athlete_key", athleteKeys)
    .gte("captured_at", startISO)
    .lt("captured_at", endISO);
  if (e1) throw e1;

  const result: Record<string, DailyBestRow[]> = {};
  if (!own || own.length === 0) return result;
  const ownFiltered = (own as { athlete_key: string; event_name: string; age_class: string; sub_category: string; event_category: string; result_text: string; result_numeric: number | null }[])
    .filter((r) => !isRoadOrCrossCountry(r));
  if (ownFiltered.length === 0) return result;

  // Collect distinct (event, age) pairs to fetch
  const pairs = new Set<string>();
  for (const r of ownFiltered) {
    const key = `${r.event_name}|${r.age_class}`;
    pairs.add(key);
  }
  const eventNames = Array.from(new Set(ownFiltered.map((r) => r.event_name)));
  const ageClasses = Array.from(new Set(ownFiltered.map((r) => r.age_class).filter(Boolean) as string[]));

  // 2. Fetch all rows for those events/ages today
  const { data: all, error: e2 } = await supabase
    .from("athlete_results")
    .select(
      "event_name, sub_category, event_category, age_class, result_text, result_numeric, result_rank, athlete_key, surname, firstname, organization, organization_id, competition_name, competition_id, competition_date, event_id",
    )
    .in("event_name", eventNames)
    .in("age_class", ageClasses.length > 0 ? ageClasses : [""])
    .gte("captured_at", startISO)
    .lt("captured_at", endISO)
    .not("result_numeric", "is", null);
  if (e2) throw e2;

  // Step 1: per (competition, event, age) keep the official winner (lowest
  // result_rank from tuloslista).
  const perCompetition = new Map<string, DailyBestRow>();
  const allRows = ((all ?? []) as DailyBestRow[]).filter((r) => !isRoadOrCrossCountry(r));
  for (const row of allRows) {
    const k = `${row.competition_id}|${row.event_name}|${row.age_class}`;
    const cur = perCompetition.get(k);
    if (!cur) {
      perCompetition.set(k, row);
      continue;
    }
    const a = row.result_rank ?? Number.POSITIVE_INFINITY;
    const b = cur.result_rank ?? Number.POSITIVE_INFINITY;
    if (a < b) perCompetition.set(k, row);
  }

  // Step 2: across competitions for the same (event, age) pick the best.
  const bestByPair = new Map<string, DailyBestRow>();
  for (const row of perCompetition.values()) {
    const k = `${row.event_name}|${row.age_class}`;
    if (!pairs.has(k)) continue;
    const cur = bestByPair.get(k);
    if (!cur) {
      bestByPair.set(k, row);
      continue;
    }
    const lower = isLowerBetter(row.event_category, row.sub_category);
    const a = row.result_numeric ?? Number.POSITIVE_INFINITY;
    const b = cur.result_numeric ?? Number.POSITIVE_INFINITY;
    if (lower ? a < b : a > b) bestByPair.set(k, row);
  }

  // 3. Attach the best for each athlete's (event, age) pair
  for (const r of ownFiltered) {
    const k = `${r.event_name}|${r.age_class}`;
    const best = bestByPair.get(k);
    if (!best) continue;
    (result[r.athlete_key] ??= []).push(best);
  }
  // De-dup per athlete (athlete may have multiple rows for same event)
  for (const k of Object.keys(result)) {
    const seen = new Set<string>();
    result[k] = result[k].filter((b) => {
      const id = `${b.event_name}|${b.age_class}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  return result;
}

function reduceBest(rows: DailyBestRow[]): DailyBestRow[] {
  // Step 1: per (competition, event, age) keep the official winner from
  // tuloslista — the row with the lowest result_rank. This avoids guessing
  // whether a numeric comparison should pick the smallest or largest value
  // within one competition.
  const perCompetition = new Map<string, DailyBestRow>();
  for (const r of rows) {
    const k = `${r.competition_id}|${r.event_name}|${r.age_class}`;
    const cur = perCompetition.get(k);
    if (!cur) {
      perCompetition.set(k, r);
      continue;
    }
    const a = r.result_rank ?? Number.POSITIVE_INFINITY;
    const b = cur.result_rank ?? Number.POSITIVE_INFINITY;
    if (a < b) perCompetition.set(k, r);
  }

  // Step 2: across competitions for the same (event, age) pick the best
  // numerically — here we still need to know the direction (lower/higher
  // better) because it spans multiple competitions.
  const map = new Map<string, DailyBestRow>();
  for (const r of perCompetition.values()) {
    const k = `${r.event_name}|${r.age_class}`;
    const cur = map.get(k);
    if (!cur) {
      map.set(k, r);
      continue;
    }
    const lower = isLowerBetter(r.event_category, r.sub_category);
    const a = r.result_numeric ?? Number.POSITIVE_INFINITY;
    const b = cur.result_numeric ?? Number.POSITIVE_INFINITY;
    if (lower ? a < b : a > b) map.set(k, r);
  }
  return Array.from(map.values()).sort((a, b) => {
    const ageCmp = sortAgeClass(a.age_class, b.age_class);
    if (ageCmp !== 0) return ageCmp;
    return a.event_name.localeCompare(b.event_name, "fi");
  });
}

/** Sort age classes: M, N first; then youth alphanumerically. */
export function sortAgeClass(a: string, b: string): number {
  const order = (s: string) => {
    if (s === "M" || s === "N") return 0;
    if (/^[A-ZÄÖ]\d/.test(s)) return 1; // M14, T16
    return 2;
  };
  const oa = order(a);
  const ob = order(b);
  if (oa !== ob) return oa - ob;
  return a.localeCompare(b, "fi");
}
