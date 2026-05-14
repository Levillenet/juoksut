// Read-only helpers for "today's results for a chosen club" — driven by the
// background-harvested athlete_results table.

import { supabase } from "@/integrations/supabase/client";
import { helsinkiDayBounds } from "./daily-best";

export interface ClubTodayRow {
  athlete_key: string;
  surname: string;
  firstname: string;
  organization: string;
  organization_id: number | null;
  competition_id: number;
  competition_name: string;
  event_name: string;
  age_class: string;
  sub_category: string;
  event_category: string;
  result_text: string;
  result_numeric: number | null;
  result_rank: number | null;
  was_pb: boolean;
}

export interface ClubOption {
  id: number;
  name: string;
  athletes: number;
}

/** Distinct organizations that have at least one result today, optionally excluding a competition. */
export async function fetchTodayClubs(
  excludeCompetitionId?: number | null,
): Promise<ClubOption[]> {
  const { startISO, endISO } = helsinkiDayBounds(new Date());
  let query = supabase
    .from("athlete_results")
    .select("organization, organization_id, athlete_key")
    .gte("competition_date", startISO)
    .lt("competition_date", endISO)
    .not("organization_id", "is", null);
  if (excludeCompetitionId != null) {
    query = query.neq("competition_id", excludeCompetitionId);
  }
  const { data, error } = await query;
  if (error) throw error;
  const map = new Map<number, { id: number; name: string; athletes: Set<string> }>();
  for (const r of (data ?? []) as Array<{
    organization: string;
    organization_id: number | null;
    athlete_key: string;
  }>) {
    if (r.organization_id == null) continue;
    if (!map.has(r.organization_id)) {
      map.set(r.organization_id, {
        id: r.organization_id,
        name: r.organization ?? "",
        athletes: new Set(),
      });
    }
    map.get(r.organization_id)!.athletes.add(r.athlete_key);
  }
  return Array.from(map.values())
    .map((c) => ({ id: c.id, name: c.name, athletes: c.athletes.size }))
    .sort((a, b) => a.name.localeCompare(b.name, "fi"));
}

/** All of today's results for athletes from the given organization, optionally excluding a competition. */
export async function fetchClubTodayResults(
  organizationId: number,
  excludeCompetitionId?: number | null,
): Promise<ClubTodayRow[]> {
  const { startISO, endISO } = helsinkiDayBounds(new Date());
  let query = supabase
    .from("athlete_results")
    .select(
      "athlete_key, surname, firstname, organization, organization_id, competition_id, competition_name, event_name, age_class, sub_category, event_category, result_text, result_numeric, result_rank, was_pb",
    )
    .eq("organization_id", organizationId)
    .gte("competition_date", startISO)
    .lt("competition_date", endISO);
  if (excludeCompetitionId != null) {
    query = query.neq("competition_id", excludeCompetitionId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ClubTodayRow[];
}

export type ClubPbMap = Record<string, { text: string; numeric: number }>;

/** Strip leading age-class prefix (e.g. "T11 60m" -> "60m", "M 60m" -> "60m"). */
export function normalizeEventName(name: string): string {
  return name.replace(/^(?:[MNT]\d*|P\d+)\s+/i, "").trim();
}

/** Best historical result per (athlete_key, normalized event_name). */
export async function fetchClubPbs(
  athleteKeys: string[],
  eventNames: string[],
): Promise<ClubPbMap> {
  if (athleteKeys.length === 0 || eventNames.length === 0) return {};
  // Don't filter by event_name in SQL — names contain age-class prefixes that
  // change year over year. Pull all numeric results for these athletes and
  // group by normalized name in memory.
  const { data, error } = await supabase
    .from("athlete_results")
    .select("athlete_key, event_name, event_category, result_text, result_numeric")
    .in("athlete_key", athleteKeys)
    .not("result_numeric", "is", null)
    .limit(10000);
  if (error) throw error;
  const map: ClubPbMap = {};
  for (const r of (data ?? []) as Array<{
    athlete_key: string;
    event_name: string;
    event_category: string;
    result_text: string;
    result_numeric: number;
  }>) {
    if (r.result_numeric == null) continue;
    const key = `${r.athlete_key}|${normalizeEventName(r.event_name)}`;
    const lower = r.event_category === "Track";
    const cur = map[key];
    if (
      !cur ||
      (lower ? r.result_numeric < cur.numeric : r.result_numeric > cur.numeric)
    ) {
      map[key] = { text: r.result_text, numeric: r.result_numeric };
    }
  }
  return map;
}
