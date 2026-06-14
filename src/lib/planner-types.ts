// Tyypit kilpailuaikataulun suunnittelutyökaluun.

export type VenueKind =
  | "track_straight"
  | "track_oval"
  | "jump_pit"
  | "high_jump"
  | "pole_vault"
  | "shot_ring"
  | "throw_cage"
  | "throw_ring"
  | "throw_runway"
  | "other";

export const VENUE_KIND_LABEL: Record<VenueKind, string> = {
  track_straight: "Juoksusuora",
  track_oval: "Ovaali (rata)",
  jump_pit: "Pituus/kolmiloikka",
  high_jump: "Korkeushyppy",
  pole_vault: "Seiväshyppy",
  shot_ring: "Kuulakehä",
  throw_cage: "Moukari-/kiekkohäkki",
  throw_ring: "Heittokehä (muu)",
  throw_runway: "Heittovauhdinotto",
  other: "Muu",
};

export type FinalFormat = "direct" | "a_b";
export type SchedulePhase = "single" | "heats" | "final_a" | "final_b";

/** Monipäivätapahtuman päiväikkunan tieto. */
export interface DayWindow {
  /** ISO-päivämäärä YYYY-MM-DD */
  date: string;
  /** Päivän aloitusaika (HH:mm) */
  start: string;
  /** Päivän lopetusaika (HH:mm) */
  end: string;
}

export interface PlanRow {
  id: string;
  user_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  default_recovery_min: number;
  default_setup_field_min: number;
  default_setup_vertical_min: number;
  default_between_heats_min: number;
  default_hurdle_setup_min: number;
  default_hurdle_teardown_min: number;
  is_multi_day: boolean;
  day_windows: DayWindow[] | null;
  notes: string | null;
  stadium_id: string | null;
  total_officials_available: number;
  officials_changeover_min: number;
  created_at: string;
  updated_at: string;
}

export interface VenueRow {
  id: string;
  plan_id: string;
  name: string;
  kind: VenueKind;
  sort_order: number;
  notes: string | null;
  stadium_venue_id: string | null;
  included: boolean;
}

export interface ConflictGroupRow {
  id: string;
  plan_id: string;
  name: string;
  description: string | null;
  venue_ids: string[];
  max_concurrent: number;
  source_stadium_group_id: string | null;
}

export interface StadiumRow {
  id: string;
  user_id: string;
  name: string;
  location: string | null;
  notes: string | null;
}

export interface StadiumVenueRow {
  id: string;
  stadium_id: string;
  name: string;
  kind: VenueKind;
  sort_order: number;
  notes: string | null;
}

export interface StadiumConflictGroupRow {
  id: string;
  stadium_id: string;
  name: string;
  description: string | null;
  venue_ids: string[];
  max_concurrent: number;
}

export interface PlanEventRow {
  id: string;
  plan_id: string;
  age_class: string;
  event_name: string;
  sub_category: string | null;
  participants: number;
  final_format: FinalFormat;
  final_cut: number | null;
  station_count: number;
  heat_size: number;
  override_duration_min: number | null;
  setup_before_min: number | null;
  between_heats_min: number | null;
  hurdle_setup_min: number | null;
  hurdle_teardown_min: number | null;
  /** Sallitut päivät (YYYY-MM-DD). null = vapaa. */
  allowed_days: string[] | null;
  notes: string | null;
  sort_order: number;
}

export interface ScheduleItemRow {
  id: string;
  plan_id: string;
  plan_event_id: string;
  venue_id: string;
  phase: SchedulePhase;
  starts_at: string;
  ends_at: string;
  auto_generated: boolean;
  notes: string | null;
}

export interface CatalogEntry {
  age_class: string;
  event_name_display: string;
  event_key: string;
  sample_count: number;
}

/** Päivittää tapahtuman alku- ja loppuajan day_windowsin perusteella tai luo yksipäiväisen oletuksen. */
export function resolveDayWindows(plan: PlanRow): Array<{ startMs: number; endMs: number; date: string }> {
  if (plan.is_multi_day && plan.day_windows && plan.day_windows.length > 0) {
    return plan.day_windows.map((d) => {
      const start = new Date(`${d.date}T${d.start}:00`);
      const end = new Date(`${d.date}T${d.end}:00`);
      return { startMs: start.getTime(), endMs: end.getTime(), date: d.date };
    });
  }
  const s = new Date(plan.starts_at);
  const e = new Date(plan.ends_at);
  const date = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`;
  return [{ startMs: s.getTime(), endMs: e.getTime(), date }];
}
