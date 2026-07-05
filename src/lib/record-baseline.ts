import { supabase } from "@/integrations/supabase/client";
import { getHistoricalBest, getHistoricalSeasonBest } from "@/lib/history-baseline";
import type { Allocation } from "@/lib/tuloslista";

export interface Baseline {
  pb: string;
  sb: string;
}

// In-memory cache: eventId -> (athleteId -> baseline)
const cache = new Map<number, Map<number, Baseline>>();
// Tracks which (competition, event) pairs we've already attempted to capture
// in this browser session, to avoid re-uploading the same rows on every refresh.
const captureAttempted = new Set<string>();

function key(c: number, e: number) {
  return `${c}:${e}`;
}

/**
 * Capture PB/SB baselines for an event. Insert-only — primary key conflicts
 * are silently ignored, so the very first snapshot per athlete wins.
 *
 * Only captures rows where the athlete has PB or SB but NO Result yet,
 * so we never freeze a baseline that already includes the just-set result.
 */
export async function captureBaselines(
  competitionId: number,
  eventId: number,
  allocations: Allocation[],
): Promise<void> {
  const k = key(competitionId, eventId);
  if (captureAttempted.has(k)) return;
  captureAttempted.add(k);

  // Deduplicate by athlete id (same athlete can appear in multiple heats).
  const seen = new Set<number>();
  const rows: {
    competition_id: number;
    event_id: number;
    athlete_id: number;
    pb: string;
    sb: string;
  }[] = [];

  for (const a of allocations) {
    if (!a.Id || seen.has(a.Id)) continue;
    if (a.Result) continue; // too late — result already set
    if (!a.PB && !a.SB) continue; // nothing to compare against later
    seen.add(a.Id);
    rows.push({
      competition_id: competitionId,
      event_id: eventId,
      athlete_id: a.Id,
      pb: a.PB ?? "",
      sb: a.SB ?? "",
    });
  }

  if (rows.length === 0) return;

  // Fire-and-forget; ignore errors (unauthenticated, network, etc.)
  try {
    await supabase
      .from("record_baseline")
      .upsert(rows, {
        onConflict: "competition_id,event_id,athlete_id",
        ignoreDuplicates: true,
      });
  } catch {
    /* ignore */
  }
}

/**
 * Load all baseline rows for a (competition, event) into the cache and
 * return the resulting map. Re-loads each call so newly captured rows
 * from other clients become visible.
 */
export async function loadBaselines(
  competitionId: number,
  eventId: number,
): Promise<Map<number, Baseline>> {
  try {
    const { data } = await supabase
      .from("record_baseline")
      .select("athlete_id, pb, sb")
      .eq("competition_id", competitionId)
      .eq("event_id", eventId);
    const map = new Map<number, Baseline>();
    for (const r of data ?? []) {
      map.set(r.athlete_id, { pb: r.pb ?? "", sb: r.sb ?? "" });
    }
    cache.set(eventId, map);
    return map;
  } catch {
    return cache.get(eventId) ?? new Map();
  }
}

/** Synchronous read of the in-memory cache (for render code). */
export function getCachedBaseline(
  eventId: number,
  athleteId: number,
): Baseline | undefined {
  return cache.get(eventId)?.get(athleteId);
}

/**
 * Resolve effective PB/SB for comparison. Kaikki kolme lähdettä (kaappaus,
 * tuloslistan alloc, oma historia) huomioidaan ja lopuksi valitaan aidosti
 * paras — tuloslistan `alloc.PB` voi olla vanhentunut, joten sitä ei saa
 * suoraan luottaa jos DB:ssä on parempi tulos.
 *
 * `history.category` kertoo suunnan (Track = pienempi voittaa). Jos sitä ei
 * anneta, tyydytään vanhaan prioriteettijärjestykseen (kaappaus → alloc →
 * historia).
 */
export function effectiveRecord(
  eventId: number,
  alloc: { Id: number; PB: string; SB: string },
  history?:
    | {
        competitionId: number;
        athleteKey: string;
        eventName: string;
        ageClass?: string | null;
        category?: string | null;
      }
    | null,
): { pb: string; sb: string } {
  const b = getCachedBaseline(eventId, alloc.Id);
  const historicalPb = history
    ? getHistoricalBest(history.competitionId, history.athleteKey, history.eventName, history.ageClass)
    : null;
  const historicalSb = history
    ? getHistoricalSeasonBest(history.competitionId, history.athleteKey, history.eventName, history.ageClass)
    : null;

  const isTrack = history?.category === "Track";
  return {
    pb: pickBest([b?.pb, alloc.PB, historicalPb], isTrack),
    sb: pickBest([b?.sb, alloc.SB, historicalSb], isTrack),
  };
}

function pickBest(values: (string | null | undefined)[], lowerBetter: boolean): string {
  let bestText = "";
  let bestNum: number | null = null;
  for (const v of values) {
    if (!v) continue;
    const n = parseResult(v);
    if (n == null) {
      if (!bestText) bestText = v;
      continue;
    }
    if (bestNum == null || (lowerBetter ? n < bestNum : n > bestNum)) {
      bestNum = n;
      bestText = v;
    }
  }
  return bestText;
}
