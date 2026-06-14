ALTER TABLE public.plan_events 
  ADD COLUMN IF NOT EXISTS officials_count INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS officials_role_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS officials_count_overridden BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.competition_plans
  ADD COLUMN IF NOT EXISTS total_officials_available INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS officials_changeover_min INTEGER DEFAULT 10;