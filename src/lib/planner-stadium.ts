// Stadionien integrointi kisasuunnitelmaan.
// applyStadiumToPlan kopioi stadionin suorituspaikat ja rajoiteryhmät planiin.
// removeStadiumFromPlan poistaa stadionilta tulleet rivit (säilyttäen käsin lisätyt).

import { supabase } from "@/integrations/supabase/client";
import type {
  StadiumVenueRow,
  StadiumConflictGroupRow,
  VenueRow,
} from "./planner-types";

/**
 * Liittää stadionin planiin: päivittää competition_plans.stadium_id,
 * kopioi stadionin suorituspaikat plan_venues-tauluun (included=false),
 * ja kopioi rajoiteryhmät plan_conflict_groups-tauluun id-mappauksella.
 *
 * Idempotentti: jos sama stadion on jo liitetty, ei duplikoi.
 */
export async function applyStadiumToPlan(planId: string, stadiumId: string): Promise<void> {
  // 1) Päivitä plan
  {
    const { error } = await supabase
      .from("competition_plans")
      .update({ stadium_id: stadiumId })
      .eq("id", planId);
    if (error) throw error;
  }

  // 2) Hae stadionin paikat ja ryhmät
  const [venuesRes, groupsRes, existingRes] = await Promise.all([
    supabase
      .from("stadium_venues")
      .select("*")
      .eq("stadium_id", stadiumId)
      .order("sort_order"),
    supabase
      .from("stadium_conflict_groups")
      .select("*")
      .eq("stadium_id", stadiumId),
    supabase
      .from("plan_venues")
      .select("*")
      .eq("plan_id", planId),
  ]);
  if (venuesRes.error) throw venuesRes.error;
  if (groupsRes.error) throw groupsRes.error;
  if (existingRes.error) throw existingRes.error;

  const stadiumVenues = (venuesRes.data ?? []) as StadiumVenueRow[];
  const stadiumGroups = (groupsRes.data ?? []) as StadiumConflictGroupRow[];
  const existing = (existingRes.data ?? []) as VenueRow[];

  // Map stadium_venue_id -> plan_venue.id (joko olemassa tai juuri lisätty)
  const stadiumToPlanVenue = new Map<string, string>();
  for (const v of existing) {
    if (v.stadium_venue_id) stadiumToPlanVenue.set(v.stadium_venue_id, v.id);
  }

  // 3) Lisää puuttuvat paikat
  const toInsert = stadiumVenues
    .filter((sv) => !stadiumToPlanVenue.has(sv.id))
    .map((sv, i) => ({
      plan_id: planId,
      name: sv.name,
      kind: sv.kind,
      sort_order: existing.length + i,
      notes: sv.notes,
      stadium_venue_id: sv.id,
      included: false,
    }));

  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from("plan_venues")
      .insert(toInsert)
      .select("id, stadium_venue_id");
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.stadium_venue_id) stadiumToPlanVenue.set(row.stadium_venue_id, row.id);
    }
  }

  // 4) Kopioi rajoiteryhmät — älä duplikoi jos source_stadium_group_id on jo olemassa
  const { data: existingGroups, error: egErr } = await supabase
    .from("plan_conflict_groups")
    .select("source_stadium_group_id")
    .eq("plan_id", planId);
  if (egErr) throw egErr;
  const existingSources = new Set(
    (existingGroups ?? [])
      .map((g) => g.source_stadium_group_id)
      .filter((x): x is string => !!x),
  );

  const groupsToInsert = stadiumGroups
    .filter((g) => !existingSources.has(g.id))
    .map((g) => ({
      plan_id: planId,
      name: g.name,
      description: g.description,
      venue_ids: g.venue_ids
        .map((vid) => stadiumToPlanVenue.get(vid))
        .filter((x): x is string => !!x),
      max_concurrent: g.max_concurrent,
      source_stadium_group_id: g.id,
    }));

  if (groupsToInsert.length > 0) {
    const { error } = await supabase.from("plan_conflict_groups").insert(groupsToInsert);
    if (error) throw error;
  }
}

/**
 * Irrottaa stadionin planista: poistaa stadionilta tulleet plan_venues-rivit
 * (stadium_venue_id IS NOT NULL) ja plan_conflict_groups-rivit
 * (source_stadium_group_id IS NOT NULL). Käsin lisätyt säilyvät.
 */
export async function removeStadiumFromPlan(planId: string): Promise<void> {
  await supabase
    .from("plan_conflict_groups")
    .delete()
    .eq("plan_id", planId)
    .not("source_stadium_group_id", "is", null);

  await supabase
    .from("plan_venues")
    .delete()
    .eq("plan_id", planId)
    .not("stadium_venue_id", "is", null);

  const { error } = await supabase
    .from("competition_plans")
    .update({ stadium_id: null })
    .eq("id", planId);
  if (error) throw error;
}
