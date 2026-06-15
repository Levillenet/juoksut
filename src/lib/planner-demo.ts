// Demokilpailun rakentaminen: täyttää suunnitelman YU-paikoilla ja katalogin
// tyypillisillä lajeilla, jotta aikataulun saa heti generoitua.

import { supabase } from "@/integrations/supabase/client";
import { buildDefaultVenueRows } from "./planner-defaults";
import type { CatalogEntry } from "./planner-types";

const DEFAULT_VENUE_SELECTION: Record<string, number> = {
  sprint: 1,
  oval: 1,
  long_jump: 2,

  high_jump: 1,
  pole_vault: 1,
  shot: 1,
  discus: 1,
  javelin: 1,
};

/** Lajinimet, jotka halutaan oletuksena jokaiselle sopivalle ikäryhmälle. */
const PREFERRED_PATTERNS = [
  /^60\s*m$/i,
  /^100\s*m$/i,
  /^200\s*m$/i,
  /^400\s*m$/i,
  /^800\s*m$/i,
  /^1500\s*m$/i,
  /^60\s*m\s*ai/i,
  /^80\s*m\s*ai/i,
  /^100\s*m\s*ai/i,
  /^110\s*m\s*ai/i,
  /pituus/i,
  /korkeus/i,
  /seiv/i,
  /kuula/i,
  /kiekko/i,
  /keih/i,
  /kolmi/i,
];

export interface DemoOptions {
  planId: string;
  minParticipants?: number;
  maxParticipants?: number;
  /** Vain nämä ikäluokat (jätä tyhjäksi → kaikki) */
  ageClassFilter?: string[];
}

export async function fillPlanWithDemo({
  planId,
  minParticipants = 6,
  maxParticipants = 24,
  ageClassFilter,
}: DemoOptions): Promise<{ venueCount: number; eventCount: number }> {
  // 1) Hae katalogi
  const { data: catalog, error: catErr } = await supabase.rpc("get_event_catalog_full");
  if (catErr) throw catErr;
  const entries = (catalog ?? []) as CatalogEntry[];

  // 2) Tyhjennä olemassa olevat (aikataulu, lajit, paikat)
  await supabase.from("plan_schedule_items").delete().eq("plan_id", planId);
  await supabase.from("plan_events").delete().eq("plan_id", planId);
  await supabase.from("plan_venues").delete().eq("plan_id", planId);

  // 3) Lisää YU-kentän oletuspaikat
  const venueRows = buildDefaultVenueRows(DEFAULT_VENUE_SELECTION).map((r) => ({
    ...r,
    plan_id: planId,
  }));
  if (venueRows.length > 0) {
    const { error } = await supabase.from("plan_venues").insert(venueRows);
    if (error) throw error;
  }

  // 4) Suodata katalogista demolajit
  const selected = entries.filter((e) => {
    if (ageClassFilter && !ageClassFilter.includes(e.age_class)) return false;
    return PREFERRED_PATTERNS.some((p) => p.test(e.event_name_display));
  });

  // 5) Yksi rivi per (ikäluokka, lajinimi) — vältä duplikaatit
  const seen = new Set<string>();
  type EventInsert = {
    plan_id: string;
    age_class: string;
    event_name: string;
    participants: number;
    station_count: number;
    final_format: "direct" | "a_b";
    final_cut: number | null;
    sort_order: number;
  };
  const eventRows: EventInsert[] = [];
  let order = 0;
  for (const e of selected) {
    const key = `${e.age_class}|${e.event_name_display.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const participants =
      minParticipants + Math.floor(Math.random() * (maxParticipants - minParticipants + 1));
    const isField =
      /pituus|korkeus|seiv|kuula|kiekko|keih|kolmi/i.test(e.event_name_display);
    eventRows.push({
      plan_id: planId,
      age_class: e.age_class,
      event_name: e.event_name_display,
      participants,
      station_count: 1,
      final_format: isField ? "direct" : participants > 8 ? "a_b" : "direct",
      final_cut: isField ? null : 8,
      sort_order: order++,
    });
  }
  if (eventRows.length > 0) {
    const { error } = await supabase.from("plan_events").insert(eventRows);
    if (error) throw error;
  }

  return { venueCount: venueRows.length, eventCount: eventRows.length };
}

/** Rakenna suunnitelma aiemman kilpailun rakenteesta. */
export async function fillPlanFromCompetition(
  planId: string,
  competitionId: number,
): Promise<{ venueCount: number; eventCount: number; startISO: string; endISO: string }> {
  const { data: rows, error } = await supabase.rpc("get_competition_structure", {
    p_competition_id: competitionId,
  });
  if (error) throw error;
  const structure = (rows ?? []) as Array<{
    age_class: string;
    event_name_display: string;
    event_key: string;
    participants: number;
    first_capture: string;
    last_capture: string;
    duration_min: number;
  }>;

  await supabase.from("plan_schedule_items").delete().eq("plan_id", planId);
  await supabase.from("plan_events").delete().eq("plan_id", planId);
  await supabase.from("plan_venues").delete().eq("plan_id", planId);

  // YU-kentän oletuspaikat
  const venueRows = buildDefaultVenueRows(DEFAULT_VENUE_SELECTION).map((r) => ({
    ...r,
    plan_id: planId,
  }));
  if (venueRows.length > 0) {
    const { error: vErr } = await supabase.from("plan_venues").insert(venueRows);
    if (vErr) throw vErr;
  }

  let order = 0;
  const eventRows = structure.map((s) => {
    const isField =
      /pituus|korkeus|seiv|kuula|kiekko|keih|kolmi|moukari/i.test(s.event_name_display);
    return {
      plan_id: planId,
      age_class: s.age_class,
      event_name: s.event_name_display,
      participants: s.participants,
      station_count: 1,
      final_format: isField ? "direct" : s.participants > 8 ? "a_b" : "direct",
      final_cut: isField ? null : 8,
      // ÄLÄ käytä RPC:n duration_min:iä — se mittaa tuloksensyöttöikkunaa,
      // ei lajin todellista kestoa. Anna sääntöpohjaisen estimaattorin laskea.
      override_duration_min: null,
      sort_order: order++,
    };
  });
  if (eventRows.length > 0) {
    const { error: eErr } = await supabase.from("plan_events").insert(eventRows);
    if (eErr) throw eErr;
  }

  // Aseta plan-aikaikkuna kilpailun min/max captureista
  const allTimes = structure.flatMap((s) => [s.first_capture, s.last_capture]);
  const minMs = Math.min(...allTimes.map((t) => new Date(t).getTime()));
  const maxMs = Math.max(...allTimes.map((t) => new Date(t).getTime()));
  const start = new Date(minMs);
  start.setMinutes(0, 0, 0);
  const end = new Date(maxMs);
  end.setMinutes(0, 0, 0);
  end.setHours(end.getHours() + 1);
  const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 3600 * 1000));
  const isMulti = days > 1;

  const startISO = start.toISOString();
  const endISO = end.toISOString();
  await supabase
    .from("competition_plans")
    .update({
      starts_at: startISO,
      ends_at: endISO,
      is_multi_day: isMulti,
    })
    .eq("id", planId);

  return {
    venueCount: venueRows.length,
    eventCount: eventRows.length,
    startISO,
    endISO,
  };
}

export interface TemplateCompetition {
  competition_id: number;
  competition_name: string;
  competition_date: string;
  location: string | null;
  result_count: number;
  age_class_count: number;
  event_count: number;
  duration_days: number;
}

export async function listTemplateCompetitions(year: number): Promise<TemplateCompetition[]> {
  const { data, error } = await supabase.rpc("list_planner_template_competitions", {
    p_year: year,
  });
  if (error) throw error;
  return (data ?? []) as TemplateCompetition[];
}
