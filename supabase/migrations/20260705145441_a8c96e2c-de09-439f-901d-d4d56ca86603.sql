ALTER TABLE public.result_videos
  ADD COLUMN IF NOT EXISTS event_category text,
  ADD COLUMN IF NOT EXISTS heat_key text;

-- Backfill event_category from athlete_results where possible
UPDATE public.result_videos rv
SET event_category = ar.event_category
FROM (
  SELECT DISTINCT ON (athlete_key, competition_id, event_name)
    athlete_key, competition_id, event_name, event_category
  FROM public.athlete_results
  ORDER BY athlete_key, competition_id, event_name, captured_at DESC NULLS LAST
) ar
WHERE rv.event_category IS NULL
  AND rv.athlete_key = ar.athlete_key
  AND rv.competition_id = ar.competition_id
  AND rv.event_name = ar.event_name;

CREATE OR REPLACE FUNCTION public.enforce_video_public_only_for_track()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_public = true
     AND coalesce(NEW.event_category, '') NOT IN ('Track', 'Relay') THEN
    RAISE EXCEPTION 'Julkinen videolinkki sallitaan vain juoksu- ja viestilajeille (event_category=Track/Relay).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_video_public_only_for_track ON public.result_videos;
CREATE TRIGGER trg_enforce_video_public_only_for_track
BEFORE INSERT OR UPDATE ON public.result_videos
FOR EACH ROW EXECUTE FUNCTION public.enforce_video_public_only_for_track();