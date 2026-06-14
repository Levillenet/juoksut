// Tyypit kilpailuaikataulun suunnittelutyökaluun.

export type VenueKind =
  | "track_straight"
  | "track_oval"
  | "jump_pit"
  | "high_jump"
  | "pole_vault"
  | "throw_ring"
  | "throw_runway"
  | "other";

export const VENUE_KIND_LABEL: Record<VenueKind, string> = {
  track_straight: "Juoksusuora",
  track_oval: "Ovaali (rata)",
  jump_pit: "Pituus/kolmiloikka",
  high_jump: "Korkeushyppy",
  pole_vault: "Seiväshyppy",
  throw_ring: "Heittokehä",
  throw_runway: "Heittovauhdinotto",
  other: "Muu",
};

export type FinalFormat = "direct" | "a_b";
export type SchedulePhase = "single" | "heats" | "final_a" | "final_b";

export interface PlanRow {
  id: string;
  user_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  default_recovery_min: number;
  notes: string | null;
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
  override_duration_min: number | null;
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
