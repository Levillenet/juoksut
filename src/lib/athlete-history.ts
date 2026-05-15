// Read-only access to harvested athlete result history.
// All data is collected by the background harvester
// (src/routes/api/public/hooks/harvest-results.ts) and persisted to
// athlete_results. Client code only reads.

import { supabase } from "@/integrations/supabase/client";

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
}

/** Track times "11.34", "1:23.45" → seconds. Field marks "12.34" → meters. */
export function parseResultNumeric(text: string, category: string): number | null {
  if (!text) return null;
  const cleaned = text.trim().replace(",", ".").replace(/[a-zA-Z]/g, "").trim();
  if (!cleaned || /^(DNF|DNS|DQ|NM|FAIL)$/i.test(text.trim())) return null;
  if (category === "Track") {
    const parts = cleaned.split(":").map((p) => parseFloat(p));
    if (parts.some((n) => Number.isNaN(n))) return null;
    let s = 0;
    for (const p of parts) s = s * 60 + p;
    return s;
  }
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

export function isLowerBetter(category: string): boolean {
  return category === "Track";
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
      "id, athlete_key, surname, firstname, organization, organization_id, competition_id, competition_name, competition_date, location, event_id, event_name, sub_category, event_category, result_text, result_numeric, result_rank, wind, was_pb",
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
}

/** Strip age-class prefix ("M17 100m" → "100m", "P9 60m" → "60m") so the
 * same event across age classes groups together in the dashboard chart. */
export function normalizeEventName(name: string): string {
  if (!name) return "";
  return name.replace(/^(?:[MNTmnt][0-9]*|[Pp][0-9]+)\s+/, "").trim();
}

export function groupByEvent(rows: AthleteResultRow[]): EventGroup[] {
  const map = new Map<string, EventGroup>();
  for (const r of rows) {
    const normName = normalizeEventName(r.event_name);
    const key = `${normName}|${r.sub_category}|${r.event_category}`;
    if (!map.has(key)) {
      map.set(key, {
        eventName: normName,
        category: r.event_category,
        subCategory: r.sub_category,
        lowerBetter: isLowerBetter(r.event_category),
        rows: [],
        pb: null,
      });
    }
    map.get(key)!.rows.push(r);
  }
  for (const g of map.values()) {
    g.rows.sort((a, b) =>
      (a.competition_date ?? "").localeCompare(b.competition_date ?? ""),
    );
    let best: AthleteResultRow | null = null;
    for (const r of g.rows) {
      if (r.result_numeric == null) continue;
      if (best == null || best.result_numeric == null) {
        best = r;
        continue;
      }
      if (g.lowerBetter ? r.result_numeric < best.result_numeric : r.result_numeric > best.result_numeric) {
        best = r;
      }
    }
    g.pb = best;
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
