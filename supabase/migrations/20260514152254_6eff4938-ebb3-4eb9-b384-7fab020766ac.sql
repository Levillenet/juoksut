
ALTER TABLE public.athlete_results
  ADD COLUMN IF NOT EXISTS age_class text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS athlete_results_daily_best_idx
  ON public.athlete_results (competition_date, age_class, event_name);
