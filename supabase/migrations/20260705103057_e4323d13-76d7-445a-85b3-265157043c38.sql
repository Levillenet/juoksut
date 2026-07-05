CREATE TABLE public.result_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  athlete_key text NOT NULL,
  competition_id integer NOT NULL,
  event_name text NOT NULL,
  sub_category text NOT NULL DEFAULT '',
  youtube_url text NOT NULL,
  youtube_video_id text NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, athlete_key, competition_id, event_name, sub_category)
);

CREATE INDEX result_videos_athlete_idx ON public.result_videos (athlete_key);
CREATE INDEX result_videos_public_idx ON public.result_videos (athlete_key) WHERE is_public = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.result_videos TO authenticated;
GRANT SELECT ON public.result_videos TO anon;
GRANT ALL ON public.result_videos TO service_role;

ALTER TABLE public.result_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read public videos" ON public.result_videos
  FOR SELECT TO anon, authenticated
  USING (is_public = true OR user_id = auth.uid());

CREATE POLICY "Users insert own videos" ON public.result_videos
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own videos" ON public.result_videos
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own videos" ON public.result_videos
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER result_videos_updated_at
  BEFORE UPDATE ON public.result_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();