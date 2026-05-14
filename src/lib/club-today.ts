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
}

export interface ClubOption {
  id: number;
  name: string;
  athletes: number;
}

/** Distinct organizations that have at least one result today. */
export async function fetchTodayClubs(): Promise<ClubOption[]> {
  const { startISO, endISO } = helsinkiDayBounds(new Date());
  const { data, error } = await supabase
    .from("athlete_results")
    .select("organization, organization_id, athlete_key")
    .gte("competition_date", startISO)
    .lt("competition_date", endISO)
    .not("organization_id", "is", null);
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

/** All of today's results for athletes from the given organization. */
export async function fetchClubTodayResults(
  organizationId: number,
): Promise<ClubTodayRow[]> {
  const { startISO, endISO } = helsinkiDayBounds(new Date());
  const { data, error } = await supabase
    .from("athlete_results")
    .select(
      "athlete_key, surname, firstname, organization, organization_id, competition_id, competition_name, event_name, age_class, sub_category, event_category, result_text, result_numeric, result_rank",
    )
    .eq("organization_id", organizationId)
    .gte("competition_date", startISO)
    .lt("competition_date", endISO);
  if (error) throw error;
  return (data ?? []) as ClubTodayRow[];
}
