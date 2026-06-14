// Suomen Urheiluliiton sarjakohtaiset speksit aitajuoksuille ja heittolajeille.
// Tämä taulukko on parhaan tiedon mukainen — jos sarja/laji ei löydy, käytetään
// `age_class`-merkkijonoa fallback-avaimena, jolloin ennätys ei voi vuotaa eri
// sarjan yli vahingossa.

import { normalizeEventName } from "./athlete-history";

export type ThrowKind = "shot" | "discus" | "javelin" | "hammer";

export interface HurdlesSpec {
  kind: "hurdles";
  distance_m: number;
  height_cm: number;
  count: number;
}

export interface ThrowSpec {
  kind: "throw";
  implement: ThrowKind;
  weight_g: number;
}

export type EventSpec = HurdlesSpec | ThrowSpec;

// ---- Gender from age class -------------------------------------------------

export function genderFromAgeClass(ageClass: string | null | undefined): "M" | "F" | null {
  if (!ageClass) return null;
  const c = ageClass.trim().charAt(0).toUpperCase();
  if (c === "T" || c === "N") return "F";
  if (c === "P" || c === "M") return "M";
  return null;
}

function ageNumber(ageClass: string | null | undefined): number | null {
  if (!ageClass) return null;
  const m = ageClass.trim().match(/^[MNTPmntp](\d+)/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

function isAdultClass(ageClass: string | null | undefined): boolean {
  if (!ageClass) return false;
  const s = ageClass.trim().toUpperCase();
  // M, N, M35, M40, ... N35, N40, ... — kaikki >=19 / aikuissarjat
  if (/^[MN]\d*$/.test(s)) {
    const n = ageNumber(s);
    return n == null || n >= 19;
  }
  // P19/P22, T19/T22 myös aikuiskategorioiden välineet
  if (/^[PT](19|22)$/.test(s)) return true;
  return false;
}

// ---- Event detection -------------------------------------------------------

function lower(s: string): string {
  return s.toLowerCase();
}

export function detectHurdleDistance(eventName: string): number | null {
  const s = lower(normalizeEventName(eventName));
  if (!/aita|aidat|aitajuoksu|hurdle/.test(s)) return null;
  const m = s.match(/(\d{2,3})\s*m/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

export function detectThrowKind(eventName: string): ThrowKind | null {
  const s = lower(normalizeEventName(eventName));
  if (/kuula|shot\s*put/.test(s)) return "shot";
  if (/kiekko|discus/.test(s)) return "discus";
  if (/keih[aä]s|javelin/.test(s)) return "javelin";
  if (/moukari|hammer/.test(s)) return "hammer";
  return null;
}

// ---- Hurdles table ---------------------------------------------------------

// Avain: `${gender}-${ageClass}-${distance_m}` → { height_cm, count }
// Lähde: SUL nuorten kilpailusäännöt (parhaan tiedon mukaan).
const HURDLES: Record<string, { height_cm: number; count: number }> = {
  // Tytöt
  "F-T11-60": { height_cm: 60, count: 8 },
  "F-T13-60": { height_cm: 65, count: 8 },
  "F-T13-80": { height_cm: 65, count: 8 },
  "F-T15-80": { height_cm: 76.2, count: 8 },
  "F-T15-100": { height_cm: 76.2, count: 10 },
  "F-T17-100": { height_cm: 76.2, count: 10 },
  "F-T17-400": { height_cm: 76.2, count: 10 },
  "F-T17-300": { height_cm: 76.2, count: 7 },
  "F-T19-100": { height_cm: 84, count: 10 },
  "F-T22-100": { height_cm: 84, count: 10 },
  "F-T19-400": { height_cm: 76.2, count: 10 },
  "F-T22-400": { height_cm: 76.2, count: 10 },
  // Pojat
  "M-P11-60": { height_cm: 60, count: 8 },
  "M-P13-60": { height_cm: 76.2, count: 8 },
  "M-P13-80": { height_cm: 76.2, count: 8 },
  "M-P15-100": { height_cm: 84, count: 10 },
  "M-P15-300": { height_cm: 76.2, count: 7 },
  "M-P17-110": { height_cm: 91.4, count: 10 },
  "M-P17-400": { height_cm: 84, count: 10 },
  "M-P19-110": { height_cm: 99.1, count: 10 },
  "M-P19-400": { height_cm: 91.4, count: 10 },
  "M-P22-110": { height_cm: 106.7, count: 10 },
  "M-P22-400": { height_cm: 91.4, count: 10 },
};

// Aikuissarjat (M, N + veteraanit perustasolla)
function adultHurdle(
  gender: "M" | "F",
  distance: number,
): { height_cm: number; count: number } | null {
  if (gender === "F") {
    if (distance === 100) return { height_cm: 84, count: 10 };
    if (distance === 400) return { height_cm: 76.2, count: 10 };
    if (distance === 60) return { height_cm: 84, count: 5 };
  } else {
    if (distance === 110) return { height_cm: 106.7, count: 10 };
    if (distance === 400) return { height_cm: 91.4, count: 10 };
    if (distance === 60) return { height_cm: 106.7, count: 5 };
  }
  return null;
}

function lookupHurdleSpec(
  ageClass: string | null | undefined,
  eventName: string,
): HurdlesSpec | null {
  const distance = detectHurdleDistance(eventName);
  if (distance == null) return null;
  const g = genderFromAgeClass(ageClass);
  if (!g) return null;
  if (isAdultClass(ageClass)) {
    const a = adultHurdle(g, distance);
    if (a) return { kind: "hurdles", distance_m: distance, ...a };
  }
  const k = `${g}-${(ageClass ?? "").toUpperCase()}-${distance}`;
  const hit = HURDLES[k];
  if (hit) return { kind: "hurdles", distance_m: distance, ...hit };
  return null;
}

// ---- Throws table (weight in grams) ---------------------------------------

// Per (gender, ageClass) → weight grams. Aikuissarjat erikseen.
const THROWS_GIRLS: Record<string, Partial<Record<ThrowKind, number>>> = {
  T9:  { shot: 1000, discus: 600 },
  T10: { shot: 1000, discus: 600 },
  T11: { shot: 2000, discus: 600 },
  T12: { shot: 2000, discus: 600 },
  T13: { shot: 3000, discus: 600, javelin: 400, hammer: 3000 },
  T14: { shot: 3000, discus: 1000, javelin: 400, hammer: 3000 },
  T15: { shot: 3000, discus: 1000, javelin: 500, hammer: 3000 },
  T16: { shot: 3000, discus: 1000, javelin: 500, hammer: 3000 },
  T17: { shot: 3000, discus: 1000, javelin: 500, hammer: 4000 },
};

const THROWS_BOYS: Record<string, Partial<Record<ThrowKind, number>>> = {
  P9:  { shot: 1000, discus: 600 },
  P10: { shot: 1500, discus: 600 },
  P11: { shot: 2000, discus: 600 },
  P12: { shot: 3000, discus: 1000 },
  P13: { shot: 3000, discus: 1000, javelin: 500, hammer: 3000 },
  P14: { shot: 4000, discus: 1000, javelin: 500, hammer: 4000 },
  P15: { shot: 4000, discus: 1000, javelin: 600, hammer: 4000 },
  P16: { shot: 5000, discus: 1500, javelin: 600, hammer: 5000 },
  P17: { shot: 5000, discus: 1500, javelin: 700, hammer: 5000 },
  P19: { shot: 6000, discus: 1750, javelin: 800, hammer: 6000 },
  P22: { shot: 6000, discus: 2000, javelin: 800, hammer: 6000 },
};

const THROWS_WOMEN_ADULT: Record<ThrowKind, number> = {
  shot: 4000,
  discus: 1000,
  javelin: 600,
  hammer: 4000,
};

const THROWS_MEN_ADULT: Record<ThrowKind, number> = {
  shot: 7260,
  discus: 2000,
  javelin: 800,
  hammer: 7260,
};

function lookupThrowSpec(
  ageClass: string | null | undefined,
  eventName: string,
): ThrowSpec | null {
  const kind = detectThrowKind(eventName);
  if (!kind) return null;
  const g = genderFromAgeClass(ageClass);
  if (!g) return null;
  const s = (ageClass ?? "").trim().toUpperCase();
  // T19/T22 → naisten välineet; P19/P22 erikseen taulukossa
  if (/^T(19|22)$/.test(s)) {
    return { kind: "throw", implement: kind, weight_g: THROWS_WOMEN_ADULT[kind] };
  }
  if (isAdultClass(s) && /^[MN]/.test(s)) {
    const weight = g === "F" ? THROWS_WOMEN_ADULT[kind] : THROWS_MEN_ADULT[kind];
    return { kind: "throw", implement: kind, weight_g: weight };
  }
  const table = g === "F" ? THROWS_GIRLS : THROWS_BOYS;
  const row = table[s];
  if (!row) return null;
  const w = row[kind];
  if (w == null) return null;
  return { kind: "throw", implement: kind, weight_g: w };
}

// ---- Public API ------------------------------------------------------------

export function getEventSpec(
  ageClass: string | null | undefined,
  eventName: string,
): EventSpec | null {
  return lookupHurdleSpec(ageClass, eventName) ?? lookupThrowSpec(ageClass, eventName);
}

/** Stable string key uniquely identifying the spec (or null if unknown). */
export function eventSpecKey(
  ageClass: string | null | undefined,
  eventName: string,
): string | null {
  const spec = getEventSpec(ageClass, eventName);
  if (!spec) return null;
  if (spec.kind === "hurdles") {
    return `H-${spec.distance_m}-${spec.height_cm}-${spec.count}`;
  }
  return `T-${spec.implement}-${spec.weight_g}`;
}

/** Human readable suffix, e.g. "(50 cm × 8)" or "(4 kg)". Empty if unknown. */
export function eventSpecLabel(
  ageClass: string | null | undefined,
  eventName: string,
): string {
  const spec = getEventSpec(ageClass, eventName);
  if (!spec) return "";
  if (spec.kind === "hurdles") {
    return `(${formatCm(spec.height_cm)} × ${spec.count})`;
  }
  return `(${formatKg(spec.weight_g)})`;
}

function formatCm(cm: number): string {
  return Number.isInteger(cm) ? `${cm} cm` : `${cm.toFixed(1)} cm`;
}

function formatKg(g: number): string {
  if (g % 1000 === 0) return `${g / 1000} kg`;
  return `${(g / 1000).toFixed(g === 7260 ? 2 : 3).replace(/0+$/, "").replace(/\.$/, "")} kg`;
}
