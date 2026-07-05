import { supabase } from "@/integrations/supabase/client";

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

/** Parse a YouTube URL/id and return the 11-char video id, or null. */
export function parseYoutubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  // Bare id
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
      // /shorts/:id, /embed/:id, /live/:id
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
 * Fetch all videos for one athlete that the current viewer can see:
 * - own videos (any privacy)
 * - other users' public videos
 * RLS enforces this server-side.
 */
export async function fetchVideosForAthlete(
  athleteKey: string,
): Promise<Map<VideoKey, ResultVideo[]>> {
  const { data, error } = await supabase
    .from("result_videos")
    .select(
      "id, user_id, athlete_key, competition_id, event_name, sub_category, youtube_url, youtube_video_id, is_public, updated_at",
    )
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

export async function upsertResultVideo(params: {
  athleteKey: string;
  competitionId: number;
  eventName: string;
  subCategory: string;
  youtubeUrl: string;
  isPublic: boolean;
}): Promise<ResultVideo> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Kirjaudu sisään tallentaaksesi videolinkin.");
  const videoId = parseYoutubeId(params.youtubeUrl);
  if (!videoId) throw new Error("Anna kelvollinen YouTube-linkki.");

  const { data, error } = await supabase
    .from("result_videos")
    .upsert(
      {
        user_id: userId,
        athlete_key: params.athleteKey,
        competition_id: params.competitionId,
        event_name: params.eventName,
        sub_category: params.subCategory ?? "",
        youtube_url: params.youtubeUrl.trim(),
        youtube_video_id: videoId,
        is_public: params.isPublic,
      },
      { onConflict: "user_id,athlete_key,competition_id,event_name,sub_category" },
    )
    .select(
      "id, user_id, athlete_key, competition_id, event_name, sub_category, youtube_url, youtube_video_id, is_public, updated_at",
    )
    .single();
  if (error) throw error;
  return data as ResultVideo;
}

export async function deleteResultVideo(id: string): Promise<void> {
  const { error } = await supabase.from("result_videos").delete().eq("id", id);
  if (error) throw error;
}
