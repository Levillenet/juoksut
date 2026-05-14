
-- Cursor for the background harvester. Singleton row tracks how far the
-- backfill has progressed (next_id) and the highest known competition id
-- (latest_id) so the nightly job can extend the upper bound.
CREATE TABLE IF NOT EXISTS public.harvest_state (
  id text PRIMARY KEY DEFAULT 'singleton',
  next_id integer NOT NULL DEFAULT 17000,
  latest_id integer NOT NULL DEFAULT 17000,
  last_run_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT harvest_state_singleton CHECK (id = 'singleton')
);

ALTER TABLE public.harvest_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read harvest state" ON public.harvest_state;
CREATE POLICY "Authenticated can read harvest state"
  ON public.harvest_state FOR SELECT TO authenticated USING (true);

INSERT INTO public.harvest_state (id, next_id, latest_id)
VALUES ('singleton', 17000, 17000)
ON CONFLICT (id) DO NOTHING;

-- Helpful index for the dashboard / record queries which read by athlete_key.
CREATE INDEX IF NOT EXISTS athlete_results_athlete_key_idx
  ON public.athlete_results (athlete_key);
CREATE INDEX IF NOT EXISTS athlete_results_org_idx
  ON public.athlete_results (organization_id);
CREATE INDEX IF NOT EXISTS athlete_results_event_idx
  ON public.athlete_results (event_name, sub_category);
