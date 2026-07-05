import { supabase } from "@/integrations/supabase/client";

export interface HeatResultSnapshot {
  position: number | null;
  surname: string | null;
  firstname: string | null;
  organization: string | null;
  result_text: string | null;
  result_rank: number | null;
}

export interface ResultVideo {
  id: string;
  user_id: string;
  athlete_key: string;
  competition_id: number;
  event_name: string;
  sub_category: string;
  youtube_url: string;
  youtube_video_id: string;
  is_public: boolean;
  event_category: string | null;
  heat_key: string | null;
  heat_results: HeatResultSnapshot[] | null;
  updated_at: string;
}

export type VideoKey = string;

export function videoKey(
  competitionId: number,
  eventName: string,
  subCategory: string,
): VideoKey {
  return `${competitionId}|${eventName}|${subCategory ?? ""}`;
}

/** Public videos are only allowed for running / relay events. */
export function isTrackCategory(category: string | null | undefined): boolean {
  return category === "Track" || category === "Relay";
}

export function heatAthleteKey(heatId: number | string): string {
  return `heat:${heatId}`;
}

const SELECT_COLS =
  "id, user_id, athlete_key, competition_id, event_name, sub_category, youtube_url, youtube_video_id, is_public, event_category, heat_key, heat_results, updated_at";

/** Parse a YouTube URL/id and return the 11-char video id, or null. */
export function parseYoutubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const v = u.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2 && ["shorts", "embed", "live", "v"].includes(parts[0])) {
        return /^[a-zA-Z0-9_-]{11}$/.test(parts[1]) ? parts[1] : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function embedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

/**
 * Fetch all videos for one athlete that the current viewer can see.
 */
export async function fetchVideosForAthlete(
  athleteKey: string,
): Promise<Map<VideoKey, ResultVideo[]>> {
  const { data, error } = await supabase
    .from("result_videos")
    .select(SELECT_COLS)
    .eq("athlete_key", athleteKey);
  if (error) throw error;
  const map = new Map<VideoKey, ResultVideo[]>();
  for (const v of (data ?? []) as ResultVideo[]) {
    const k = videoKey(v.competition_id, v.event_name, v.sub_category ?? "");
    const list = map.get(k) ?? [];
    list.push(v);
    map.set(k, list);
  }
  return map;
}

export async function insertResultVideo(params: {
  athleteKey: string;
  competitionId: number;
  eventName: string;
  subCategory: string;
  youtubeUrl: string;
  isPublic: boolean;
  eventCategory: string | null;
  heatKey?: string | null;
  heatResults?: HeatResultSnapshot[] | null;
}): Promise<ResultVideo> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Kirjaudu sisään tallentaaksesi videolinkin.");
  const videoId = parseYoutubeId(params.youtubeUrl);
  if (!videoId) throw new Error("Anna kelvollinen YouTube-linkki.");

  if (params.isPublic && !isTrackCategory(params.eventCategory)) {
    throw new Error(
      "Julkinen videolinkki on sallittu vain juoksu- ja viestilajeille. Yksilölajissa video tallennetaan yksityisenä.",
    );
  }

  const { data, error } = await supabase
    .from("result_videos")
    .insert({
      user_id: userId,
      athlete_key: params.athleteKey,
      competition_id: params.competitionId,
      event_name: params.eventName,
      sub_category: params.subCategory ?? "",
      youtube_url: params.youtubeUrl.trim(),
      youtube_video_id: videoId,
      is_public: params.isPublic,
      event_category: params.eventCategory ?? null,
      heat_key: params.heatKey ?? null,
      heat_results: (params.heatResults && params.heatResults.length > 0 ? params.heatResults : null) as any,
    })
    .select(SELECT_COLS)
    .single();
  if (error) throw error;
  return data as ResultVideo;
}

export async function updateResultVideo(
  id: string,
  params: { youtubeUrl: string; isPublic: boolean; eventCategory?: string | null },
): Promise<ResultVideo> {
  const videoId = parseYoutubeId(params.youtubeUrl);
  if (!videoId) throw new Error("Anna kelvollinen YouTube-linkki.");
  if (params.isPublic && params.eventCategory !== undefined && !isTrackCategory(params.eventCategory)) {
    throw new Error(
      "Julkinen videolinkki on sallittu vain juoksu- ja viestilajeille.",
    );
  }
  const patch: {
    youtube_url: string;
    youtube_video_id: string;
    is_public: boolean;
    event_category?: string | null;
  } = {
    youtube_url: params.youtubeUrl.trim(),
    youtube_video_id: videoId,
    is_public: params.isPublic,
  };
  if (params.eventCategory !== undefined) patch.event_category = params.eventCategory;

  const { data, error } = await supabase
    .from("result_videos")
    .update(patch)
    .eq("id", id)
    .select(SELECT_COLS)
    .single();
  if (error) throw error;
  return data as ResultVideo;
}

export async function deleteResultVideo(id: string): Promise<void> {
  const { error } = await supabase.from("result_videos").delete().eq("id", id);
  if (error) throw error;
}

/** Fetch heat-scoped videos (public + own) for the given heat ids in a competition. */
export async function fetchHeatVideos(
  competitionId: number,
  heatIds: (number | string)[],
): Promise<Map<string, ResultVideo[]>> {
  if (heatIds.length === 0) return new Map();
  const keys = heatIds.map((id) => `heat:${id}`);
  const { data, error } = await supabase
    .from("result_videos")
    .select(SELECT_COLS)
    .eq("competition_id", competitionId)
    .in("heat_key", keys);
  if (error) throw error;
  const map = new Map<string, ResultVideo[]>();
  for (const v of (data ?? []) as ResultVideo[]) {
    const k = v.heat_key ?? "";
    const list = map.get(k) ?? [];
    list.push(v);
    map.set(k, list);
  }
  return map;
}

/**
 * Lightweight index of public videos in the last 14 days for badge display.
 * Returns a Set of keys `${competition_id}|${event_name}`.
 */
export async function fetchPublicVideoIndex(): Promise<Set<string>> {
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("result_videos")
    .select("competition_id, event_name")
    .eq("is_public", true)
    .gte("created_at", since)
    .limit(500);
  if (error) throw error;
  const set = new Set<string>();
  for (const r of data ?? []) {
    set.add(`${r.competition_id}|${r.event_name}`);
  }
  return set;
}
