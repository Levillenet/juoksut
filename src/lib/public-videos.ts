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
 * Fetch recent public result videos and enrich each with the matching
 * athlete_results row (athlete + result).
 *
 * @param opts.sinceHours Lookback window in hours. Defaults to 48.
 * @param opts.limit Max rows returned. Defaults to 30.
 */
export async function fetchPublicVideos(opts?: {
  sinceHours?: number;
  limit?: number;
}): Promise<PublicVideoItem[]> {
  const sinceHours = opts?.sinceHours ?? 48;
  const limit = opts?.limit ?? 30;
  const sinceIso = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();
  const { data: vids, error } = await supabase
    .from("result_videos")
    .select(
      "id, athlete_key, competition_id, event_name, sub_category, youtube_url, youtube_video_id, created_at",
    )
    .eq("is_public", true)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit);
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

export interface HeatResultRow {
  athlete_key: string;
  surname: string | null;
  firstname: string | null;
  organization: string | null;
  result_text: string | null;
  result_rank: number | null;
  age_class: string | null;
}

/**
 * Fetch all athlete results for a specific heat (competition + event + sub_category).
 * Deduplicated by athlete_key (newest captured_at), sorted by result_rank.
 */
export async function fetchHeatResults(
  competitionId: number,
  eventName: string,
  subCategory: string | null,
): Promise<HeatResultRow[]> {
  let query = supabase
    .from("athlete_results")
    .select(
      "athlete_key, surname, firstname, organization, result_text, result_rank, age_class, sub_category, captured_at",
    )
    .eq("competition_id", competitionId)
    .eq("event_name", eventName);
  if (subCategory) query = query.eq("sub_category", subCategory);
  else query = query.is("sub_category", null);
  const { data, error } = await query;
  if (error) throw error;

  const byKey = new Map<string, any>();
  for (const r of data ?? []) {
    if (r.athlete_key?.startsWith("heat:")) continue;
    const prev = byKey.get(r.athlete_key);
    if (!prev || (r.captured_at ?? "") > (prev.captured_at ?? "")) {
      byKey.set(r.athlete_key, r);
    }
  }
  return Array.from(byKey.values())
    .map((r) => ({
      athlete_key: r.athlete_key,
      surname: r.surname,
      firstname: r.firstname,
      organization: r.organization,
      result_text: r.result_text,
      result_rank: r.result_rank,
      age_class: r.age_class,
    }))
    .sort((a, b) => {
      const ar = a.result_rank ?? 9999;
      const br = b.result_rank ?? 9999;
      return ar - br;
    });
}

/**
 * Fetch all public videos for a single (competition_id, event_name) pair.
 * Newest first, enriched with athlete + result info.
 */
export async function fetchPublicVideosForEvent(
  competitionId: number,
  eventName: string,
): Promise<PublicVideoItem[]> {
  const { data: vids, error } = await supabase
    .from("result_videos")
    .select(
      "id, athlete_key, competition_id, event_name, sub_category, youtube_url, youtube_video_id, created_at",
    )
    .eq("is_public", true)
    .eq("competition_id", competitionId)
    .eq("event_name", eventName)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = vids ?? [];
  if (rows.length === 0) return [];

  const { data: results } = await supabase
    .from("athlete_results")
    .select(
      "athlete_key, surname, firstname, organization, competition_id, competition_name, competition_date, event_name, sub_category, age_class, result_text, result_rank, captured_at",
    )
    .eq("competition_id", competitionId)
    .eq("event_name", eventName);

  const resultIndex = new Map<string, any>();
  for (const r of results ?? []) {
    const k = `${r.athlete_key}|${r.sub_category ?? ""}`;
    const prev = resultIndex.get(k);
    if (!prev || (r.captured_at ?? "") > (prev.captured_at ?? "")) {
      resultIndex.set(k, r);
    }
  }

  return rows.map((v) => {
    const isHeat = v.athlete_key.startsWith("heat:");
    const r = resultIndex.get(`${v.athlete_key}|${v.sub_category ?? ""}`);
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

