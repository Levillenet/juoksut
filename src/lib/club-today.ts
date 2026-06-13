// Read-only helpers for "today's results for a chosen club" — driven by the
// background-harvested athlete_results table.

import { supabase } from "@/integrations/supabase/client";
import { normalizeEventName } from "./athlete-history";
import { helsinkiDayBounds } from "./daily-best";
import { isRoadOrCrossCountry } from "./event-filters";

export interface ClubTodayRow {
  athlete_key: string;
  surname: string;
  firstname: string;
  organization: string;
  organization_id: number | null;
  competition_id: number;
  competition_name: string;
  event_id: number;
  event_name: string;
  age_class: string;
  sub_category: string;
  event_category: string;
  result_text: string;
  result_numeric: number | null;
  result_rank: number | null;
  result_round_name: string;
  was_pb: boolean;
}

export interface ClubOption {
  id: number;
  name: string;
  athletes: number;
}

/** Distinct organizations that have at least one result on the given date, optionally excluding a competition. */
export async function fetchTodayClubs(
  excludeCompetitionId?: number | null,
  date?: Date,
): Promise<ClubOption[]> {
  const { startISO, endISO } = helsinkiDayBounds(date ?? new Date());
  let query = supabase
    .from("athlete_results")
    .select("organization, organization_id, athlete_key, event_name, event_category, sub_category")
    .gte("captured_at", startISO)
    .lt("captured_at", endISO)
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
    event_name: string;
    event_category: string;
    sub_category: string;
  }>) {
    if (r.organization_id == null) continue;
    if (isRoadOrCrossCountry(r)) continue;
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

/** All of the given date's results for athletes from the given organization, optionally excluding a competition. */
export async function fetchClubTodayResults(
  organizationId: number,
  excludeCompetitionId?: number | null,
  date?: Date,
): Promise<ClubTodayRow[]> {
  const { startISO, endISO } = helsinkiDayBounds(date ?? new Date());
  let query = supabase
    .from("athlete_results")
    .select(
      "athlete_key, surname, firstname, organization, organization_id, competition_id, competition_name, event_id, event_name, age_class, sub_category, event_category, result_text, result_numeric, result_rank, result_round_name, was_pb",
    )
    .eq("organization_id", organizationId)
    .gte("captured_at", startISO)
    .lt("captured_at", endISO);
  if (excludeCompetitionId != null) {
    query = query.neq("competition_id", excludeCompetitionId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as ClubTodayRow[]).filter((r) => !isRoadOrCrossCountry(r));
}

export type ClubPbMap = Record<string, { text: string; numeric: number; category: string }>;

// Re-export shared normalizer so that today's rows ("T11 Korkeus (E)") match
// historical rows ("T11 Korkeus") when looking up previous PBs.
export { normalizeEventName };

/** Best historical result per (athlete_key, normalized event_name), optionally
 * limited to results strictly before `beforeISO`. */
export async function fetchClubPbs(
  athleteKeys: string[],
  eventNames: string[],
  beforeISO?: string,
): Promise<ClubPbMap> {
  if (athleteKeys.length === 0 || eventNames.length === 0) return {};
  // Don't filter by event_name in SQL — names contain age-class prefixes that
  // change year over year. Pull all numeric results for these athletes and
  // group by normalized name in memory.
  let query = supabase
    .from("athlete_results")
    .select("athlete_key, event_name, event_category, sub_category, result_text, result_numeric, competition_date")
    .in("athlete_key", athleteKeys)
    .not("result_numeric", "is", null)
    .limit(10000);
  if (beforeISO) query = query.lt("captured_at", beforeISO);
  const { data, error } = await query;
  if (error) throw error;
  const map: ClubPbMap = {};
  for (const r of (data ?? []) as Array<{
    athlete_key: string;
    event_name: string;
    event_category: string;
    sub_category: string;
    result_text: string;
    result_numeric: number;
  }>) {
    if (r.result_numeric == null) continue;
    if (isRoadOrCrossCountry(r)) continue;
    const key = `${r.athlete_key}|${normalizeEventName(r.event_name)}`;
    const lower = r.event_category === "Track";
    const cur = map[key];
    if (
      !cur ||
      (lower ? r.result_numeric < cur.numeric : r.result_numeric > cur.numeric)
    ) {
      map[key] = { text: r.result_text, numeric: r.result_numeric, category: r.event_category };
    }
  }
  return map;
}

/** Best result strictly before the given date — used to compute today's PB improvement. */
export async function fetchClubPreviousPbs(
  athleteKeys: string[],
  eventNames: string[],
  beforeDate: Date,
): Promise<ClubPbMap> {
  const { startISO } = helsinkiDayBounds(beforeDate);
  return fetchClubPbs(athleteKeys, eventNames, startISO);
}

export interface RelayLegRow {
  competition_id: number;
  event_id: number;
  team_athlete_key: string;
  leg_index: number;
  firstname: string;
  surname: string;
}

export type RelayLegMap = Map<string, RelayLegRow[]>;

function relayLegKey(competitionId: number, eventId: number, teamKey: string) {
  return `${competitionId}|${eventId}|${teamKey}`;
}

/** Fetch relay leg rows for the given team-result rows. Keyed by
 * `${competition_id}|${event_id}|${team_athlete_key}`. */
export async function fetchRelayLegsForRows(
  rows: Array<{ competition_id: number; event_id: number; athlete_key: string; event_category: string }>,
): Promise<RelayLegMap> {
  const teamKeys = Array.from(
    new Set(rows.filter((r) => r.event_category === "Relay").map((r) => r.athlete_key)),
  );
  const compIds = Array.from(
    new Set(rows.filter((r) => r.event_category === "Relay").map((r) => r.competition_id)),
  );
  const out: RelayLegMap = new Map();
  if (teamKeys.length === 0 || compIds.length === 0) return out;
  const { data, error } = await supabase
    .from("relay_legs")
    .select("competition_id, event_id, team_athlete_key, leg_index, firstname, surname")
    .in("competition_id", compIds)
    .in("team_athlete_key", teamKeys);
  if (error) return out;
  for (const r of (data ?? []) as RelayLegRow[]) {
    const k = relayLegKey(r.competition_id, r.event_id, r.team_athlete_key);
    if (!out.has(k)) out.set(k, []);
    out.get(k)!.push(r);
  }
  return out;
}

export function getRelayLegs(
  legs: RelayLegMap,
  competitionId: number,
  eventId: number,
  teamKey: string,
): RelayLegRow[] | undefined {
  return legs.get(relayLegKey(competitionId, eventId, teamKey));
}
