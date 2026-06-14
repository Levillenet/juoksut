// Sääntöpohjainen kestoarvio YAG 2022 -aikatauludatan perusteella.
// Yksi totuus: kaikki lajityypit ja kaavat tässä tiedostossa.

export type EventKind =
  | "track"
  | "jump_pit"
  | "high_jump"
  | "pole_vault"
  | "shot_discus_hammer"
  | "javelin"
  | "other";

export interface RuleInput {
  event_name: string;
  sub_category?: string | null;
  participants: number;
  /** Juoksu: lanea per erä. Default 8 (tai 16 jos matka ≥ 1000 m). */
  heat_size?: number | null;
  /** Kentälajit: rinnakkaisten suorituspaikkojen määrä. Default 1. */
  station_count?: number | null;
}

export interface RuleResult {
  minutes: number;
  formula: string;
  kind: EventKind;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Lue juoksumatka (m) lajinimestä. Tukee "60m", "60 m", "1km", "1.5 km" ja "3000 m kävely". */
export function parseTrackDistanceM(eventName: string): number | null {
  const n = (eventName ?? "").toLowerCase();
  const km = n.match(/(\d+(?:[.,]\d+)?)\s*km\b/);
  if (km) return Math.round(parseFloat(km[1].replace(",", ".")) * 1000);
  const m = n.match(/(\d{2,5})\s*m\b/);
  if (m) return parseInt(m[1], 10);
  return null;
}

export function isHurdles(eventName: string, sub?: string | null): boolean {
  const n = (eventName ?? "").toLowerCase();
  return /aita|aidat|hurdle/.test(n) || (sub ?? "").toLowerCase().includes("hurdle");
}

export function isWalk(eventName: string): boolean {
  return /käv|kävely|walk/i.test(eventName ?? "");
}

/** Aika per erä (min) juoksulajeissa lajinimen perusteella (YAG 2022). */
export function minutesPerHeat(eventName: string, sub?: string | null): number {
  const d = parseTrackDistanceM(eventName);
  if (isWalk(eventName)) {
    if (d && d >= 3000) return 18;
    return 10; // 1000–2000 m kävely
  }
  if (isHurdles(eventName, sub)) return 6;
  if (d == null) return 5;
  if (d >= 3000) return 18;
  if (d >= 1500) return 10;
  if (d >= 1000) return 8;
  if (d >= 600) return 8;
  if (d === 400) return 6;
  if (d >= 200) return 5;
  if (d >= 100) return 5;
  if (d >= 40) return 4;
  return 5;
}

/** Oletus-lanea per erä. Aitajuoksuissa 16; pitkillä matkoilla 16–30; muuten 8. */
export function defaultHeatSize(eventName: string, sub?: string | null): number {
  if (isHurdles(eventName, sub)) return 16;
  const d = parseTrackDistanceM(eventName);
  if (d != null && d >= 3000) return 30;
  if (d != null && d >= 1500) return 20;
  if (d != null && d >= 1000) return 16;
  return 8;
}

export function isTrackEventName(eventName: string, sub?: string | null): boolean {
  if (isHurdles(eventName, sub)) return true;
  const s = (sub ?? "").toLowerCase();
  if (s.startsWith("sprint") || s.startsWith("run") || s.includes("relay") || s.includes("walk")) return true;
  return parseTrackDistanceM(eventName) != null;
}

export function classifyEvent(eventName: string, sub?: string | null): EventKind {
  const n = (eventName ?? "").toLowerCase();
  const s = (sub ?? "").toLowerCase();
  if (isTrackEventName(eventName, sub)) return "track";
  if (s.includes("polevault") || /seiv/.test(n)) return "pole_vault";
  if (s.includes("highjump") || /korkeus/.test(n)) return "high_jump";
  if (s.includes("longjump") || s.includes("triplejump") || /pituus|kolmiloikka/.test(n)) return "jump_pit";
  if (/kuula|kiekko|moukari|shot|discus|hammer/.test(n)) return "shot_discus_hammer";
  if (/keih|javelin/.test(n)) return "javelin";
  return "other";
}

export function computeRuleEstimate(input: RuleInput): RuleResult {
  const n = Math.max(0, input.participants ?? 0);
  const stations = Math.max(1, input.station_count ?? 1);
  const kind = classifyEvent(input.event_name, input.sub_category);

  switch (kind) {
    case "track": {
      const lanes = Math.max(1, input.heat_size ?? defaultHeatSize(input.event_name));
      const perHeat = minutesPerHeat(input.event_name, input.sub_category);
      const heats = Math.max(1, Math.ceil(n / lanes));
      const minutes = heats * perHeat;
      return {
        minutes,
        formula: `${n} osall. / ${lanes} lanea = ${heats} erää × ${perHeat} min = ${minutes} min`,
        kind,
      };
    }
    case "jump_pit": {
      const raw = (n * 1.2) / stations + 15;
      const minutes = Math.round(raw);
      return {
        minutes,
        formula: `${n} × 1,2 min / ${stations} paikka${stations === 1 ? "" : "a"} + 15 min valm. = ${minutes} min`,
        kind,
      };
    }
    case "high_jump": {
      const raw = 60 + Math.max(0, n - 10) * 2;
      const minutes = clamp(Math.round(raw), 45, 150);
      return {
        minutes,
        formula: `60 + max(0; ${n} − 10) × 2 = ${Math.round(raw)} min (rajat 45–150) → ${minutes} min`,
        kind,
      };
    }
    case "pole_vault": {
      const raw = 75 + Math.max(0, n - 8) * 4;
      const minutes = clamp(Math.round(raw), 60, 180);
      return {
        minutes,
        formula: `75 + max(0; ${n} − 8) × 4 = ${Math.round(raw)} min (rajat 60–180) → ${minutes} min`,
        kind,
      };
    }
    case "shot_discus_hammer": {
      const raw = 25 + n * 1.5;
      const minutes = clamp(Math.round(raw), 30, 90);
      return {
        minutes,
        formula: `25 + ${n} × 1,5 = ${Math.round(raw)} min (rajat 30–90) → ${minutes} min`,
        kind,
      };
    }
    case "javelin": {
      const raw = 30 + n * 1.7;
      const minutes = clamp(Math.round(raw), 35, 100);
      return {
        minutes,
        formula: `30 + ${n} × 1,7 = ${Math.round(raw)} min (rajat 35–100) → ${minutes} min`,
        kind,
      };
    }
    default: {
      const minutes = Math.max(20, 15 + n * 2);
      return { minutes, formula: `oletus 15 + ${n} × 2 = ${minutes} min`, kind };
    }
  }
}
