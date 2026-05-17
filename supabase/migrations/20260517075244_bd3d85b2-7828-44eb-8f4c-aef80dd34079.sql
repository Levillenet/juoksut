CREATE TABLE public.announcer_settings (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcer_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own announcer settings"
  ON public.announcer_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own announcer settings"
  ON public.announcer_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own announcer settings"
  ON public.announcer_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own announcer settings"
  ON public.announcer_settings FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_announcer_settings_updated_at
  BEFORE UPDATE ON public.announcer_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();