ALTER TABLE public.official_competition_calls
  ADD COLUMN IF NOT EXISTS target_clubs text[] NOT NULL DEFAULT '{}'::text[];