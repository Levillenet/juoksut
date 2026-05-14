// Client-side harvester for athlete result history across tuloslista competitions.
// The cached-public-api allows direct CORS reads, including for past competition IDs
// that no longer appear on the live /competition listing. We scan an ID range,
// fetch each competition's events, look for matching athletes (by surname+firstname,
// optionally scoped to organization id), and persist hits to the shared
// athlete_results table.

import { supabase } from "@/integrations/supabase/client";
import type { Allocation } from "./tuloslista";
import { athleteKey } from "./watch-store";

const API = "https://cached-public-api.tuloslista.com/live/v1";

export interface HarvestTarget {
  surname: string;
  firstname: string;
  organizationId: number | null;
}

export interface HarvestProgress {
  scanned: number;
  total: number;
  found: number;
  current?: string;
}

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
}

interface PropertiesShape {
  Competition?: {
    Id: number;
    Name?: string;
    BeginDate?: string;
    Organization?: string;
  };
}

interface EventShape {
  Id: number;
  Name: string;
  EventCategory?: string;
  EventSubCategory?: string;
  BeginDateTimeWithTZ?: string;
  Rounds: { Heats: { Allocations: Allocation[] }[] }[];
}

interface RoundsByDateShape {
  [date: string]: { EventId: number }[];
}

/** Track times "11.34", "1:23.45", "12:34.56" → seconds. Field marks "12.34" → meters. */
export function parseResultNumeric(text: string, category: string): number | null {
  if (!text) return null;
  const cleaned = text.trim().replace(",", ".").replace(/[a-zA-Z]/g, "").trim();
  if (!cleaned || /^(DNF|DNS|DQ|NM|FAIL)$/i.test(text.trim())) return null;
  if (category === "Track") {
    // h:mm:ss.xx | mm:ss.xx | ss.xx
    const parts = cleaned.split(":").map((p) => parseFloat(p));
    if (parts.some((n) => Number.isNaN(n))) return null;
    let s = 0;
    for (const p of parts) s = s * 60 + p;
    return s;
  }
  // Field: meters / points (single number)
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

/** Lower is better for Track, higher for Field/everything else. */
export function isLowerBetter(category: string): boolean {
  return category === "Track";
}

function matchTarget(a: Allocation, targets: HarvestTarget[]): HarvestTarget | null {
  for (const t of targets) {
    if (a.Surname !== t.surname) continue;
    if (a.Firstname !== t.firstname) continue;
    if (t.organizationId != null && a.Organization?.Id !== t.organizationId) continue;
    return t;
  }
  return null;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export interface HarvestOptions {
  fromId: number;
  toId: number;
  concurrency?: number;
  onProgress?: (p: HarvestProgress) => void;
  signal?: AbortSignal;
}

/** Crawl competition IDs in [fromId, toId] and persist matches for any of `targets`. */
export async function harvestAthleteHistory(
  targets: HarvestTarget[],
  opts: HarvestOptions,
): Promise<{ scanned: number; found: number }> {
  if (targets.length === 0) return { scanned: 0, found: 0 };
  const { fromId, toId, onProgress, signal } = opts;
  const concurrency = opts.concurrency ?? 6;

  const ids: number[] = [];
  for (let i = toId; i >= fromId; i--) ids.push(i); // newest first
  const total = ids.length;

  let cursor = 0;
  let scanned = 0;
  let found = 0;
  const pendingRows: AthleteResultRow[] = [];

  const flush = async () => {
    if (pendingRows.length === 0) return;
    const batch = pendingRows.splice(0, pendingRows.length);
    // Strip id (DB generates), use upsert on (athlete_key, competition_id, event_id)
    const payload = batch.map(({ id: _id, ...rest }) => rest);
    await supabase.from("athlete_results").upsert(payload, {
      onConflict: "athlete_key,competition_id,event_id",
      ignoreDuplicates: true,
    });
  };

  const handleAlloc = (
    a: Allocation,
    target: HarvestTarget,
    ev: EventShape,
    props: PropertiesShape | null,
    competitionId: number,
  ) => {
    if (!a.Result) return;
    const category = ev.EventCategory ?? "";
    const subCategory = ev.EventSubCategory ?? "";
    const numeric = parseResultNumeric(a.Result, category);
    const orgId = a.Organization?.Id ?? target.organizationId ?? null;
    pendingRows.push({
      id: "",
      athlete_key: athleteKey(target.surname, target.firstname, target.organizationId),
      surname: target.surname,
      firstname: target.firstname,
      organization: a.Organization?.Name ?? "",
      organization_id: orgId,
      competition_id: competitionId,
      competition_name: props?.Competition?.Name ?? "",
      competition_date: props?.Competition?.BeginDate ?? ev.BeginDateTimeWithTZ ?? null,
      location: "",
      event_id: ev.Id,
      event_name: ev.Name,
      sub_category: subCategory,
      event_category: category,
      result_text: a.Result,
      result_numeric: numeric,
      result_rank: a.ResultRank ?? null,
      wind: a.Wind ?? null,
    });
    found++;
  };

  const worker = async () => {
    while (cursor < ids.length) {
      if (signal?.aborted) return;
      const id = ids[cursor++];
      const props = await fetchJson<PropertiesShape>(
        `${API}/competition/${id}/properties`,
        signal,
      );
      if (!props?.Competition?.Id) {
        scanned++;
        onProgress?.({ scanned, total, found });
        continue;
      }
      const compName = props.Competition.Name ?? `#${id}`;
      onProgress?.({ scanned, total, found, current: compName });
      const byDate = await fetchJson<RoundsByDateShape>(
        `${API}/competition/${id}`,
        signal,
      );
      if (byDate) {
        const eventIds = Array.from(
          new Set(Object.values(byDate).flat().map((r) => r.EventId)),
        );
        for (const eid of eventIds) {
          if (signal?.aborted) return;
          const ev = await fetchJson<EventShape>(
            `${API}/results/${id}/${eid}`,
            signal,
          );
          if (!ev) continue;
          for (const r of ev.Rounds ?? []) {
            for (const h of r.Heats ?? []) {
              for (const a of h.Allocations ?? []) {
                const t = matchTarget(a, targets);
                if (t) handleAlloc(a, t, ev, props, id);
              }
            }
          }
        }
      }
      scanned++;
      onProgress?.({ scanned, total, found });
      if (pendingRows.length >= 25) await flush();
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  await flush();
  return { scanned, found };
}

/** Fetch stored history rows for the given athlete keys, sorted by date asc. */
export async function fetchStoredHistory(
  athleteKeys: string[],
): Promise<AthleteResultRow[]> {
  if (athleteKeys.length === 0) return [];
  const { data, error } = await supabase
    .from("athlete_results")
    .select(
      "id, athlete_key, surname, firstname, organization, organization_id, competition_id, competition_name, competition_date, location, event_id, event_name, sub_category, event_category, result_text, result_numeric, result_rank, wind",
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
      "id, athlete_key, surname, firstname, organization, organization_id, competition_id, competition_name, competition_date, location, event_id, event_name, sub_category, event_category, result_text, result_numeric, result_rank, wind",
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

export function groupByEvent(rows: AthleteResultRow[]): EventGroup[] {
  const map = new Map<string, EventGroup>();
  for (const r of rows) {
    const key = `${r.event_name}|${r.sub_category}|${r.event_category}`;
    if (!map.has(key)) {
      map.set(key, {
        eventName: r.event_name,
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
