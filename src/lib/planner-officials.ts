// Toimitsijatarpeen aikajana ja huiput.
import type { PlanEventRow, ScheduleItemRow } from "./planner-types";
import { isRunningEvent } from "./planner-defaults";

/** Kuinka monta erillistä lähettäjää on aina varattuna juoksulajeihin.
 *  Sääntö: 2 lähettäjää + 1 lähdön järjestelijä / juoksu. Lähettäjät ovat
 *  samat henkilöt kaikissa juoksuissa eivätkä toimi muissa rooleissa,
 *  joten heidät lasketaan vain kerran (kun yksikin juoksu on käynnissä). */
const SHARED_STARTERS = 2;

export interface OfficialsDemandPoint {
  /** ms unix-aika */
  t: number;
  /** toimitsijoita käynnissä juuri tämän hetken jälkeen */
  demand: number;
}

export interface OfficialsInterval {
  startMs: number;
  endMs: number;
  demand: number;
  /** mitkä plan_event_id:t aktiivisia tässä välissä */
  eventIds: string[];
}

export interface OfficialsSummary {
  available: number;
  /** keskimääräinen samanaikainen kuorma (vain aikoina, jolloin > 0) */
  avg: number;
  /** huippu samanaikaisesti */
  peak: number;
  /** huipun alkuhetki (ms) */
  peakStartMs: number | null;
  /** intervallit joissa demand > available */
  overloads: OfficialsInterval[];
  /** kaikki intervallit (laskutarpeisiin) */
  intervals: OfficialsInterval[];
}

/**
 * Yksinkertainen sweep-line: jokainen aikataulu-item lisää officials_count
 * toimitsijaa väliin [starts_at, ends_at). Sama plan_event_id useassa venuessa
 * lasketaan vain kerran (heittolaji 2 mittaajaa = 1 laji, ei kahden tuplaus).
 */
export function computeOfficialsTimeline(
  schedule: ScheduleItemRow[],
  events: PlanEventRow[],
  available: number,
): OfficialsSummary {
  const eventById = new Map(events.map((e) => [e.id, e]));

  // Yhdistä useassa venue-rivissä esiintyvä sama (plan_event_id, starts_at)
  // yhdeksi event-instanssiksi.
  const seen = new Set<string>();
  const instances: Array<{ startMs: number; endMs: number; eventId: string; cost: number; isRun: boolean }> = [];
  for (const it of schedule) {
    const key = `${it.plan_event_id}|${it.starts_at}|${it.ends_at}|${it.phase}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const ev = eventById.get(it.plan_event_id);
    if (!ev) continue;
    const rawCost = Math.max(0, ev.officials_count ?? 3);
    const isRun = isRunningEvent(ev.event_name);
    // Juoksulajissa lähettäjäpari (2) on jaettu kaikille; lasketaan vain kerran
    // intervallikohtaisesti. Tässä jätetään segmenttiin vain ei-lähettäjäosuus.
    const cost = isRun ? Math.max(0, rawCost - SHARED_STARTERS) : rawCost;
    instances.push({
      startMs: new Date(it.starts_at).getTime(),
      endMs: new Date(it.ends_at).getTime(),
      eventId: it.plan_event_id,
      cost,
      isRun,
    });
  }

  if (instances.length === 0) {
    return {
      available,
      avg: 0,
      peak: 0,
      peakStartMs: null,
      overloads: [],
      intervals: [],
    };
  }

  // Kerää uniikit aikamerkit
  const tsSet = new Set<number>();
  for (const i of instances) {
    tsSet.add(i.startMs);
    tsSet.add(i.endMs);
  }
  const ts = Array.from(tsSet).sort((a, b) => a - b);

  const intervals: OfficialsInterval[] = [];
  for (let k = 0; k < ts.length - 1; k++) {
    const startMs = ts[k];
    const endMs = ts[k + 1];
    if (endMs <= startMs) continue;
    let demand = 0;
    const activeEvents: string[] = [];
    for (const inst of instances) {
      if (inst.startMs <= startMs && inst.endMs > startMs) {
        demand += inst.cost;
        activeEvents.push(inst.eventId);
      }
    }
    intervals.push({ startMs, endMs, demand, eventIds: Array.from(new Set(activeEvents)) });
  }

  // Yhdistä peräkkäiset intervallit joilla sama demand
  const merged: OfficialsInterval[] = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (last && last.demand === iv.demand && last.endMs === iv.startMs) {
      last.endMs = iv.endMs;
      last.eventIds = Array.from(new Set([...last.eventIds, ...iv.eventIds]));
    } else {
      merged.push({ ...iv });
    }
  }

  let peak = 0;
  let peakStartMs: number | null = null;
  let weightedSum = 0;
  let activeMs = 0;
  for (const iv of merged) {
    const dur = iv.endMs - iv.startMs;
    if (iv.demand > 0) {
      weightedSum += iv.demand * dur;
      activeMs += dur;
    }
    if (iv.demand > peak) {
      peak = iv.demand;
      peakStartMs = iv.startMs;
    }
  }

  const overloads = merged.filter((iv) => iv.demand > available);

  return {
    available,
    avg: activeMs > 0 ? weightedSum / activeMs : 0,
    peak,
    peakStartMs,
    overloads,
    intervals: merged,
  };
}

export function formatHHMM(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
