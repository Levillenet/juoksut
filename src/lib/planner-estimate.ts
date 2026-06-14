// Kestoarvio kilpailulajille.
// Sääntöpohjainen YAG 2022 -aikatauludatasta (planner-rules.ts).
// Override (event_duration_overrides tai override_duration_min) voittaa.
// Ei käytä event_duration_stats-mediaaneja eikä historiallista regressiota
// (ne mittaavat tuloksensyöttöikkunoita, eivät lajien todellisia kestoja).

import { supabase } from "@/integrations/supabase/client";
import { normalizeEventName } from "@/lib/event-name";
import { computeRuleEstimate, classifyEvent } from "@/lib/planner-rules";

export interface EstimateInput {
  event_name: string;
  age_class: string;
  participants: number;
  sub_category?: string | null;
  station_count?: number;
  heat_size?: number | null;
  final_format?: "direct" | "a_b";
  final_cut?: number | null;
}

export interface EstimateResult {
  estimateMinutes: number;
  finalAMinutes: number | null;
  finalBMinutes: number | null;
  sampleSize: number;
  source: "override" | "rule";
  detail: string;
}

export async function estimateDuration(input: EstimateInput): Promise<EstimateResult> {
  // 1) Override-taulu — voittaa kaavan.
  const norm = normalizeEventName(input.event_name);
  const { data: overrides } = await supabase
    .from("event_duration_overrides")
    .select("base_min, per_participant_min, age_class, event_key");
  const matched = (overrides ?? []).find(
    (o) => o.event_key === norm && (o.age_class === input.age_class || !o.age_class),
  );

  let estimate: number;
  let source: EstimateResult["source"] = "rule";
  let detail: string;

  if (matched) {
    const base = Number(matched.base_min);
    const per = Number(matched.per_participant_min);
    estimate = base + per * input.participants;
    source = "override";
    detail = `Override: ${base} + ${per} × ${input.participants} = ${Math.round(estimate)} min`;
  } else {
    const r = computeRuleEstimate({
      event_name: input.event_name,
      sub_category: input.sub_category,
      participants: input.participants,
      station_count: input.station_count,
      heat_size: input.heat_size,
    });
    estimate = r.minutes;
    detail = r.formula;
  }

  // Juoksun A/B-finaalit (kaavan päälle).
  const kind = classifyEvent(input.event_name, input.sub_category);
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
    sampleSize: 0,
    source,
    detail,
  };
}
