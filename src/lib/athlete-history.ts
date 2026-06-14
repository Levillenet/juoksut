// Read-only access to harvested athlete result history.
// All data is collected by the background harvester
// (src/routes/api/public/hooks/harvest-results.ts) and persisted to
// athlete_results. Client code only reads.

import { supabase } from "@/integrations/supabase/client";
import { parseResult } from "./result-parse";
import { normalizeEventName as _normalizeEventName } from "./event-name";
import { pbEventKey, pbEventLabel, isSpecSensitive } from "./pb-key";

export interface AthleteResultRow {
  id: string;
  athlete_key: string;
  surname: string;
  firstname: string;
  organization: string;
  organization_id: number | null;
  competition_id: number;
  competition_name: string;
  competition_date: string | null;
  location: string;
  event_id: number;
  event_name: string;
  sub_category: string;
  event_category: string;
  result_text: string;
  result_numeric: number | null;
  result_rank: number | null;
  wind: number | null;
  was_pb?: boolean;
  age_class?: string;
}

/** Track times "11.34", "1:23.45", "4.42,40", "4,18" → seconds.
 * Field marks "12.34", "4,18" → meters. Käytä shared parsijaa. */
export function parseResultNumeric(
  text: string,
  category: string,
  subCategory?: string,
  eventName?: string,
): number | null {
  return parseResult(text, { category, subCategory, eventName });
}

const TIME_SUBCATEGORIES = new Set([
  "Run",
  "Sprint",
  "MiddleDistance",
  "LongDistance",
  "Hurdles",
  "Steeple",
  "Relay",
  "Walk",
  "RoadRun",
  "CrossCountry",
]);

export function isLowerBetter(category: string, subCategory?: string): boolean {
  if (category === "Track") return true;
  if (subCategory && TIME_SUBCATEGORIES.has(subCategory)) return true;
  return false;
}

/**
 * Karkea heuristiikka, onko tulos hallikaudelta vai ulkokaudelta.
 * Käyttää ensin kilpailun/lajin nimessä ja paikassa olevia vihjeitä
 * (halli, indoor, sisä), ja jos niitä ei ole, päättelee päivämäärän
 * perusteella: hallikausi 1.10.–30.4. (vrt. seasonRange("indoor")).
 *
 * Palauttaa null jos päivämäärää ei ole eikä tekstivihjeitä löydy.
 */
export function isIndoorResult(
  row: Pick<AthleteResultRow, "competition_name" | "location" | "event_name" | "competition_date">,
): boolean | null {
  const blob = `${row.competition_name ?? ""} ${row.location ?? ""} ${row.event_name ?? ""}`.toLowerCase();
  if (/\bhalli|indoor|sisä/.test(blob)) return true;
  if (/\bulko|outdoor/.test(blob)) return false;
  if (!row.competition_date) return null;
  const d = new Date(row.competition_date);
  if (Number.isNaN(d.getTime())) return null;
  const m = d.getMonth(); // 0=Jan
  // Hallikausi: loka–huhtikuu (9,10,11,0,1,2,3). Touko–syyskuu = ulko.
  return m >= 9 || m <= 3;
}


/** Fetch stored history rows for the given athlete keys, sorted by date asc. */
export async function fetchStoredHistory(
  athleteKeys: string[],
): Promise<AthleteResultRow[]> {
  if (athleteKeys.length === 0) return [];
  const { data, error } = await supabase
    .from("athlete_results")
    .select(
      "id, athlete_key, surname, firstname, organization, organization_id, competition_id, competition_name, competition_date, location, event_id, event_name, sub_category, event_category, result_text, result_numeric, result_rank, wind, was_pb, age_class",
    )
    .in("athlete_key", athleteKeys)
    .order("competition_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AthleteResultRow[];
}

/** Fetch stored history for any athlete in the given organization id. */
export async function fetchClubHistory(
  organizationId: number,
): Promise<AthleteResultRow[]> {
  const { data, error } = await supabase
    .from("athlete_results")
    .select(
      "id, athlete_key, surname, firstname, organization, organization_id, competition_id, competition_name, competition_date, location, event_id, event_name, sub_category, event_category, result_text, result_numeric, result_rank, wind, was_pb",
    )
    .eq("organization_id", organizationId)
    .order("competition_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AthleteResultRow[];
}

export interface EventGroup {
  eventName: string;
  category: string;
  subCategory: string;
  lowerBetter: boolean;
  rows: AthleteResultRow[]; // sorted by date asc
  pb: AthleteResultRow | null;
  pbIndoor: AthleteResultRow | null;
  pbOutdoor: AthleteResultRow | null;
}

/** Strip age-class prefix ("M17 100m" → "100m", "P9 60m" → "60m") so the
 * same event across age classes groups together in the dashboard chart.
 * Also strips heat / group / schedule garbage that harvesters leave appended
 * to event names, e.g.:
 *  - "T10 Pituus - R1+2 10:30, R3+4 n.11:05" → "Pituus"
 *  - "T10 Pituus (ryhmä 2. klo 17.15)"        → "Pituus"
 *  - "T10 Korkeus kilpailu 2"                  → "Korkeus"
 *  - "N30 Pituus Ryhmä 1"                      → "Pituus"
 */
export function normalizeEventName(name: string): string {
  return _normalizeEventName(name);
}

/** Numeric rank for an age class, so the PB selection can prefer the
 * athlete's most recent (highest) age class. Adults (M/N, plus veterans
 * M40+/N40+) are treated as the highest tier. Juniors T/P + number map to
 * their age (T10 → 10, T11 → 11, P14 → 14). */
export function ageClassRank(ageClass: string | null | undefined): number {
  if (!ageClass) return 0;
  const s = ageClass.trim();
  const m = s.match(/^([MNTPmntp])(\d+)?/);
  if (!m) return 0;
  const letter = m[1].toUpperCase();
  const num = m[2] ? parseInt(m[2], 10) : null;
  if (letter === "M" || letter === "N") return 999;
  if (num == null) return 0;
  return num;
}

export function groupByEvent(rows: AthleteResultRow[]): EventGroup[] {
  // Lazy import to avoid cycles
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { pbEventKey, pbEventLabel, isSpecSensitive } = require("./pb-key") as typeof import("./pb-key");
  const map = new Map<string, EventGroup>();
  for (const r of rows) {
    const normName = normalizeEventName(r.event_name);
    // For hurdles/throws the spec (height/weight) is part of the group key,
    // so a result with different equipment is shown as its own event.
    const specKeyPart = pbEventKey(r);
    const key = `${specKeyPart}|${r.sub_category}|${r.event_category}`;
    if (!map.has(key)) {
      map.set(key, {
        eventName: pbEventLabel(r),
        category: r.event_category,
        subCategory: r.sub_category,
        lowerBetter: isLowerBetter(r.event_category, r.sub_category),
        rows: [],
        pb: null,
        pbIndoor: null,
        pbOutdoor: null,
      });
    }
    map.get(key)!.rows.push(r);
  }
  for (const g of map.values()) {
    g.rows.sort((a, b) =>
      (a.competition_date ?? "").localeCompare(b.competition_date ?? ""),
    );
    const better = (a: AthleteResultRow, b: AthleteResultRow) =>
      g.lowerBetter ? (a.result_numeric ?? Infinity) < (b.result_numeric ?? Infinity)
                    : (a.result_numeric ?? -Infinity) > (b.result_numeric ?? -Infinity);
    const ranked = g.rows.filter((r) => r.result_numeric != null);
    // For spec-sensitive events (hurdles/throws) the group already isolates
    // a single spec, so all rows in the group are valid PB candidates.
    // For other events we still prefer the athlete's highest age class.
    const specSensitive = ranked.some((r) => isSpecSensitive(r.event_name));
    let pbCandidates: AthleteResultRow[];
    if (specSensitive) {
      pbCandidates = ranked;
    } else {
      const maxRank = ranked.reduce((m, r) => Math.max(m, ageClassRank(r.age_class)), 0);
      pbCandidates = ranked.filter((r) => ageClassRank(r.age_class) === maxRank);
    }
    let best: AthleteResultRow | null = null;
    let bestIn: AthleteResultRow | null = null;
    let bestOut: AthleteResultRow | null = null;
    for (const r of pbCandidates) {
      if (best == null || better(r, best)) best = r;
      const indoor = isIndoorResult(r);
      if (indoor === true) {
        if (bestIn == null || better(r, bestIn)) bestIn = r;
      } else if (indoor === false) {
        if (bestOut == null || better(r, bestOut)) bestOut = r;
      }
    }
    g.pb = best;
    g.pbIndoor = bestIn;
    g.pbOutdoor = bestOut;
  }
  return Array.from(map.values()).sort((a, b) => a.eventName.localeCompare(b.eventName, "fi"));
}

/** Format seconds back to "mm:ss.xx" or "ss.xx" for display. */
export function formatSeconds(s: number): string {
  if (s < 60) return s.toFixed(2);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  if (m < 60) return `${m}:${rest.toFixed(2).padStart(5, "0")}`;
  const h = Math.floor(m / 60);
  const mm = m - h * 60;
  return `${h}:${String(mm).padStart(2, "0")}:${rest.toFixed(2).padStart(5, "0")}`;
}
