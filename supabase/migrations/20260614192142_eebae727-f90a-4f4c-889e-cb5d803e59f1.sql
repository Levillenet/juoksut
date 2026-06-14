
-- 1) plan_venues: stadium_venue_id + included
ALTER TABLE public.plan_venues
  ADD COLUMN IF NOT EXISTS stadium_venue_id uuid REFERENCES public.stadium_venues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS included boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS plan_venues_stadium_venue_id_idx ON public.plan_venues(stadium_venue_id);

-- 2) competition_plans: stadium_id
ALTER TABLE public.competition_plans
  ADD COLUMN IF NOT EXISTS stadium_id uuid REFERENCES public.stadiums(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS competition_plans_stadium_id_idx ON public.competition_plans(stadium_id);

-- 3) plan_conflict_groups
CREATE TABLE IF NOT EXISTS public.plan_conflict_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.competition_plans(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  venue_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  max_concurrent integer NOT NULL DEFAULT 1,
  source_stadium_group_id uuid REFERENCES public.stadium_conflict_groups(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_conflict_groups TO authenticated;
GRANT ALL ON public.plan_conflict_groups TO service_role;

ALTER TABLE public.plan_conflict_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plan owners manage conflict groups"
  ON public.plan_conflict_groups
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.competition_plans cp
    WHERE cp.id = plan_conflict_groups.plan_id AND cp.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.competition_plans cp
    WHERE cp.id = plan_conflict_groups.plan_id AND cp.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS plan_conflict_groups_plan_id_idx ON public.plan_conflict_groups(plan_id);

CREATE TRIGGER update_plan_conflict_groups_updated_at
  BEFORE UPDATE ON public.plan_conflict_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
