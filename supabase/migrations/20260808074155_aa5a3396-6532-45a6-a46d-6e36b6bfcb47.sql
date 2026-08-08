ALTER TABLE public.official_profiles
  ADD COLUMN IF NOT EXISTS can_lead boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_events text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.official_assignments
  ADD COLUMN IF NOT EXISTS is_lead boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS official_assignments_one_lead_per_round
  ON public.official_assignments (competition_id, round_id)
  WHERE is_lead;