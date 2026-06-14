// Kestoarvio kilpailulajille.
// Lähestymistapa: regressio historiadatasta jos näytteitä riittää,
// muuten lajityyppikohtainen fallback.

import { supabase } from "@/integrations/supabase/client";
import { normalizeEventName } from "@/lib/event-name";
import { eventSpecKey } from "@/lib/event-specs";

// Hyödynnetään pelkkää isRunningEvent-tietoa ei tarvita, deletoidaan importti.
// (categorize() päättelee tyypin lajinimestä ja sub_categorystä)


export interface EstimateInput {
  event_name: string;
  age_class: string;
  participants: number;
  sub_category?: string | null;
  station_count?: number;
  final_format?: "direct" | "a_b";
  final_cut?: number | null;
}

export interface EstimateResult {
  estimateMinutes: number;
  finalAMinutes: number | null;
  finalBMinutes: number | null;
  sampleSize: number;
  source: "regression" | "override" | "rule";
  detail: string;
}

interface HistorySample {
  participants: number;
  durationMin: number;
}

type EventCategoryHint = "track" | "jump_pit" | "vertical" | "throw" | "other";

function categorize(eventName: string, subCategory?: string | null): EventCategoryHint {
  const sub = (subCategory ?? "").toLowerCase();
  const n = eventName.toLowerCase();
  if (sub.startsWith("sprint") || sub.startsWith("run") || sub.includes("hurdle") || sub.includes("relay") || /m\b|km\b|aita|aidat/.test(n)) {
    return "track";
  }
  if (sub.includes("highjump") || sub.includes("polevault") || /korkeus|seiv/.test(n)) return "vertical";
  if (sub.includes("longjump") || sub.includes("triplejump") || /pituus|kolmiloikka/.test(n)) return "jump_pit";
  if (sub.includes("shot") || sub.includes("discus") || sub.includes("hammer") || sub.includes("javelin")
      || /kuula|kiekko|moukari|keih/.test(n)) return "throw";
  return "other";
}

function ruleBased(input: EstimateInput, kind: EventCategoryHint): number {
  const n = Math.max(0, input.participants);
  const stations = Math.max(1, input.station_count ?? 1);
  switch (kind) {
    case "track": {
      // 8 hlö per erä, lähtövalmistelu + erän kesto. Käytetään 4 min per erä.
      const heats = Math.max(1, Math.ceil(n / 8));
      return 6 + heats * 4;
    }
    case "jump_pit": {
      // Pituus/kolmiloikka: 6 hyppyä per kilpailija, ~1 min per hyppy, jaettuna asemien kesken.
      return Math.max(20, Math.ceil((n * 6 * 1.1) / stations) + 8);
    }
    case "vertical":
      // Korkeus/seiväs: paljon yritys-vaihtoja, perusaika + per osanottaja.
      return Math.max(45, 30 + n * 3);
    case "throw":
      // 6 yritystä × ~1 min × osanottajat / asemat, + valmistelu.
      return Math.max(20, Math.ceil((n * 6 * 1.0) / stations) + 10);
    default:
      return Math.max(20, 15 + n * 2);
  }
}

async function loadHistory(eventName: string, ageClass: string): Promise<HistorySample[]> {
  const norm = normalizeEventName(eventName);
  const specSuffix = eventSpecKey(ageClass, eventName);
  // Hakee tulosrivit: ryhmittele (competition_id, event_id) → osanottajat + kesto.
  // Käytä event_pb_key-RPC:tä? Yksinkertainen versio: matchaa name/age_class.
  const { data, error } = await supabase
    .from("athlete_results")
    .select("competition_id, event_id, captured_at, athlete_key, age_class, event_name")
    .eq("age_class", ageClass)
    .ilike("event_name", `%${norm}%`)
    .limit(20000);
  if (error) throw error;
  if (!data) return [];

  interface Bucket { athletes: Set<string>; first: string; last: string }
  const map = new Map<string, Bucket>();
  for (const r of data) {
    if (!r.event_id || !r.captured_at) continue;
    // Filtteri: jos meillä on spec-suffix (esim. aita H-60-50-8), vaadi sama spec.
    if (specSuffix) {
      const rowSpec = eventSpecKey(r.age_class ?? "", undefined, r.event_name ?? "");
      if (rowSpec !== specSuffix) continue;
    }
    const key = `${r.competition_id}:${r.event_id}`;
    const b = map.get(key) ?? { athletes: new Set(), first: r.captured_at, last: r.captured_at };
    b.athletes.add(r.athlete_key ?? "");
    if (r.captured_at < b.first) b.first = r.captured_at;
    if (r.captured_at > b.last) b.last = r.captured_at;
    map.set(key, b);
  }
  const out: HistorySample[] = [];
  for (const b of map.values()) {
    const minutes = (new Date(b.last).getTime() - new Date(b.first).getTime()) / 60000;
    if (minutes < 2 || minutes > 360) continue; // outlier-suoja
    if (b.athletes.size === 0) continue;
    out.push({ participants: b.athletes.size, durationMin: minutes });
  }
  return out;
}

function linearRegression(samples: HistorySample[]): { a: number; b: number } | null {
  if (samples.length < 3) return null;
  const n = samples.length;
  const sumX = samples.reduce((s, p) => s + p.participants, 0);
  const sumY = samples.reduce((s, p) => s + p.durationMin, 0);
  const sumXY = samples.reduce((s, p) => s + p.participants * p.durationMin, 0);
  const sumXX = samples.reduce((s, p) => s + p.participants * p.participants, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const b = (n * sumXY - sumX * sumY) / denom;
  const a = (sumY - b * sumX) / n;
  // Hylkää negatiivinen kerroin.
  if (b < 0) return null;
  return { a: Math.max(0, a), b };
}

export async function estimateDuration(input: EstimateInput): Promise<EstimateResult> {
  const kind = categorize(input.event_name, input.sub_category);
  const stations = Math.max(1, input.station_count ?? 1);

  // 1) Override-taulu
  const norm = normalizeEventName(input.event_name);
  const { data: overrides } = await supabase
    .from("event_duration_overrides")
    .select("base_min, per_participant_min, age_class, event_key");
  const matched = (overrides ?? []).find(
    (o) => o.event_key === norm && (o.age_class === input.age_class || !o.age_class),
  );

  let baseMin = 0;
  let perP = 0;
  let source: EstimateResult["source"] = "rule";
  let sampleSize = 0;
  let detail = "Lajityyppikohtainen sääntö";

  // 2) Regressio
  try {
    const history = await loadHistory(input.event_name, input.age_class);
    sampleSize = history.length;
    const reg = linearRegression(history);
    if (reg) {
      baseMin = reg.a;
      perP = reg.b;
      source = "regression";
      detail = `Regressio: ${sampleSize} aiempaa kisaa`;
    }
  } catch {
    // sallitaan, fallback rule
  }

  // 3) Override jos saatavilla — voittaa rule, mutta ei välttämättä regressiota
  if (matched && source === "rule") {
    baseMin = Number(matched.base_min);
    perP = Number(matched.per_participant_min);
    source = "override";
    detail = "Hallinnoidut oletuskestot";
  }

  let estimate: number;
  if (source === "rule") {
    estimate = ruleBased(input, kind);
  } else {
    // Skaalaa rinnakkaisten asemien mukaan (juoksulla ei vaikuta).
    const perStationDivisor = kind === "track" || kind === "vertical" ? 1 : stations;
    estimate = baseMin + (perP * input.participants) / perStationDivisor;
  }

  // Juoksuille A/B-finaalit erikseen.
  let finalAMinutes: number | null = null;
  let finalBMinutes: number | null = null;
  if (kind === "track" && input.final_format === "a_b") {
    finalAMinutes = 8;
    finalBMinutes = input.participants > (input.final_cut ?? 8) ? 8 : null;
  }

  return {
    estimateMinutes: Math.max(5, Math.round(estimate)),
    finalAMinutes,
    finalBMinutes,
    sampleSize,
    source,
    detail,
  };
}
