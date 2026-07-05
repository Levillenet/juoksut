import { supabase } from "@/integrations/supabase/client";

export interface PublicVideoItem {
  id: string;
  youtube_video_id: string;
  youtube_url: string;
  created_at: string;
  athlete_key: string;
  surname: string | null;
  firstname: string | null;
  organization: string | null;
  event_name: string;
  age_class: string | null;
  sub_category: string | null;
  result_text: string | null;
  result_rank: number | null;
  competition_name: string | null;
  competition_date: string | null;
  competition_id: number;
}

/**
 * Fetch recent public result videos (last 48h) and enrich each with the
 * matching athlete_results row (athlete + result).
 */
export async function fetchPublicVideos(): Promise<PublicVideoItem[]> {
  const sinceIso = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { data: vids, error } = await supabase
    .from("result_videos")
    .select(
      "id, athlete_key, competition_id, event_name, sub_category, youtube_url, youtube_video_id, created_at",
    )
    .eq("is_public", true)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  const rows = vids ?? [];
  if (rows.length === 0) return [];

  // Deduplicate by (athlete_key|competition_id|event_name|sub_category) — keep newest.
  const seen = new Set<string>();
  const unique = rows.filter((v) => {
    const k = `${v.athlete_key}|${v.competition_id}|${v.event_name}|${v.sub_category ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Batch-fetch matching athlete_results — include heat-marker keys via competition_id+event_name lookup
  const athleteKeys = Array.from(new Set(unique.map((v) => v.athlete_key)));
  const competitionIds = Array.from(new Set(unique.map((v) => v.competition_id)));
  const eventNames = Array.from(new Set(unique.map((v) => v.event_name)));
  const { data: results } = await supabase
    .from("athlete_results")
    .select(
      "athlete_key, surname, firstname, organization, competition_id, competition_name, competition_date, event_name, sub_category, age_class, result_text, result_rank, captured_at",
    )
    .in("competition_id", competitionIds)
    .in("event_name", eventNames);
  void athleteKeys;

  const resultIndex = new Map<string, any>();
  for (const r of results ?? []) {
    const k = `${r.athlete_key}|${r.competition_id}|${r.event_name}|${r.sub_category ?? ""}`;
    const prev = resultIndex.get(k);
    if (!prev || (r.captured_at ?? "") > (prev.captured_at ?? "")) {
      resultIndex.set(k, r);
    }
  }

  return unique.map((v) => {
    const isHeat = v.athlete_key.startsWith("heat:");
    const k = `${v.athlete_key}|${v.competition_id}|${v.event_name}|${v.sub_category ?? ""}`;
    let r = resultIndex.get(k);
    if (!r) {
      // Fallback: same competition+event (best rank / newest)
      for (const cand of results ?? []) {
        if (
          cand.competition_id === v.competition_id &&
          cand.event_name === v.event_name &&
          (!isHeat ? cand.athlete_key === v.athlete_key : true)
        ) {
          if (
            !r ||
            (cand.result_rank ?? 999) < (r.result_rank ?? 999) ||
            (cand.captured_at ?? "") > (r.captured_at ?? "")
          ) {
            r = cand;
          }
        }
      }
    }
    return {
      id: v.id,
      youtube_video_id: v.youtube_video_id,
      youtube_url: v.youtube_url,
      created_at: v.created_at,
      athlete_key: v.athlete_key,
      surname: isHeat ? null : r?.surname ?? null,
      firstname: isHeat ? null : r?.firstname ?? null,
      organization: isHeat ? null : r?.organization ?? null,
      event_name: v.event_name,
      age_class: r?.age_class ?? null,
      sub_category: v.sub_category ?? null,
      result_text: isHeat ? null : r?.result_text ?? null,
      result_rank: isHeat ? null : r?.result_rank ?? null,
      competition_name: r?.competition_name ?? null,
      competition_date: r?.competition_date ?? null,
      competition_id: v.competition_id,
    };
  });
}
