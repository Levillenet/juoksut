ALTER TABLE public.athlete_results
  ADD COLUMN IF NOT EXISTS result_round_name text NOT NULL DEFAULT '';