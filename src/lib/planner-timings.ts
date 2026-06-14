// Apufunktiot lajikohtaisten valmistelu- ja siirtymäaikojen päättelyyn.

import type { PlanEventRow, PlanRow } from "./planner-types";
import { defaultMinutesPerHeat } from "./planner-defaults";

export interface ResolvedTimings {
  setupBeforeMin: number;
  /** Aika per erä (min) juoksulajeissa — sisältää järjestäytymisen. */
  minutesPerHeatMin: number;
  hurdleSetupMin: number;
  hurdleTeardownMin: number;
  isHurdles: boolean;
  isVertical: boolean;
  isJumpPit: boolean;
  isTrack: boolean;
}

export function isHurdleEvent(eventName: string, subCategory?: string | null): boolean {
  const n = (eventName ?? "").toLowerCase();
  const s = (subCategory ?? "").toLowerCase();
  return /aita|aidat|hurdle/.test(n) || s.includes("hurdle");
}

export function isVerticalEvent(eventName: string, subCategory?: string | null): boolean {
  const n = (eventName ?? "").toLowerCase();
  const s = (subCategory ?? "").toLowerCase();
  return /korkeus|seiv/.test(n) || s.includes("highjump") || s.includes("polevault");
}

export function isJumpPitEvent(eventName: string, subCategory?: string | null): boolean {
  const n = (eventName ?? "").toLowerCase();
  const s = (subCategory ?? "").toLowerCase();
  return /pituus|kolmiloikka/.test(n) || s.includes("longjump") || s.includes("triplejump");
}

export function isTrackEvent(eventName: string, subCategory?: string | null): boolean {
  if (isHurdleEvent(eventName, subCategory)) return true;
  const n = (eventName ?? "").toLowerCase();
  const s = (subCategory ?? "").toLowerCase();
  return (
    s.startsWith("sprint") ||
    s.startsWith("run") ||
    s.includes("relay") ||
    /\d+\s*m\b|\d+\s*km\b/.test(n)
  );
}

export function suggestSetupBeforeMin(
  ev: Pick<PlanEventRow, "event_name" | "sub_category">,
  plan: Pick<PlanRow, "default_setup_field_min" | "default_setup_vertical_min">,
): number {
  if (isVerticalEvent(ev.event_name, ev.sub_category)) {
    // Seiväshyppy tarvitsee enemmän aikaa kuin korkeushyppy.
    if (/seiv/.test((ev.event_name ?? "").toLowerCase())) {
      return Math.max(plan.default_setup_vertical_min, 20);
    }
    return plan.default_setup_vertical_min;
  }
  if (isJumpPitEvent(ev.event_name, ev.sub_category)) {
    return plan.default_setup_field_min;
  }
  return 0;
}

export function resolveTimings(
  ev: PlanEventRow,
  plan: Pick<
    PlanRow,
    | "default_setup_field_min"
    | "default_setup_vertical_min"
    | "default_between_heats_min"
    | "default_hurdle_setup_min"
    | "default_hurdle_teardown_min"
  >,
): ResolvedTimings {
  const isHurdles = isHurdleEvent(ev.event_name, ev.sub_category);
  const isVertical = isVerticalEvent(ev.event_name, ev.sub_category);
  const isJumpPit = isJumpPitEvent(ev.event_name, ev.sub_category);
  const isTrack = isTrackEvent(ev.event_name, ev.sub_category);

  const setupDefault = suggestSetupBeforeMin(ev, plan);

  // `between_heats_min`-saraketta käytetään nyt yhteisellä semantiikalla "aika per erä"
  // (legacy nimi tietokannassa). Default tulee YAG 2022 -ohjearvoista lajinimen perusteella.
  const perHeatDefault = isTrack ? defaultMinutesPerHeat(ev.event_name) : 0;

  return {
    setupBeforeMin: ev.setup_before_min ?? setupDefault,
    minutesPerHeatMin: ev.between_heats_min ?? perHeatDefault,
    hurdleSetupMin: isHurdles
      ? (ev.hurdle_setup_min ?? plan.default_hurdle_setup_min)
      : 0,
    hurdleTeardownMin: isHurdles
      ? (ev.hurdle_teardown_min ?? plan.default_hurdle_teardown_min)
      : 0,
    isHurdles,
    isVertical,
    isJumpPit,
    isTrack,
  };
}

export function estimateHeatsCount(participants: number, perHeat = 8): number {
  return Math.max(1, Math.ceil(Math.max(0, participants) / perHeat));
}
