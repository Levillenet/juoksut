ALTER TABLE public.competition_plans
  ADD COLUMN IF NOT EXISTS allow_distance_change_same_venue BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS min_distance_change_gap_min INTEGER NOT NULL DEFAULT 5;