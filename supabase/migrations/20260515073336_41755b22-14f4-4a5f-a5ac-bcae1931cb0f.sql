
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.athlete_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_key TEXT NOT NULL,
  competition_id INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  sub_category TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, athlete_key, competition_id, event_name, sub_category)
);

CREATE INDEX idx_athlete_notes_lookup
  ON public.athlete_notes (user_id, athlete_key, competition_id);

ALTER TABLE public.athlete_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notes" ON public.athlete_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own notes" ON public.athlete_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own notes" ON public.athlete_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notes" ON public.athlete_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_athlete_notes_updated_at
  BEFORE UPDATE ON public.athlete_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
