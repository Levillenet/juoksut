
ALTER TABLE public.competition_plans
  ADD COLUMN IF NOT EXISTS default_setup_field_min integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS default_setup_vertical_min integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS default_between_heats_min integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS default_hurdle_setup_min integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS default_hurdle_teardown_min integer NOT NULL DEFAULT 8;

ALTER TABLE public.plan_events
  ADD COLUMN IF NOT EXISTS setup_before_min integer,
  ADD COLUMN IF NOT EXISTS between_heats_min integer,
  ADD COLUMN IF NOT EXISTS hurdle_setup_min integer,
  ADD COLUMN IF NOT EXISTS hurdle_teardown_min integer;
