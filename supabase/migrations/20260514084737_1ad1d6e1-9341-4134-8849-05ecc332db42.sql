CREATE TABLE public.watched_athletes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_key TEXT NOT NULL,
  surname TEXT NOT NULL,
  firstname TEXT NOT NULL,
  organization TEXT NOT NULL DEFAULT '',
  organization_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, athlete_key)
);

ALTER TABLE public.watched_athletes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own watched"
  ON public.watched_athletes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own watched"
  ON public.watched_athletes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own watched"
  ON public.watched_athletes FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_watched_athletes_user ON public.watched_athletes(user_id);