CREATE TABLE public.relay_legs (
  competition_id integer NOT NULL,
  event_id integer NOT NULL,
  team_alloc_id integer NOT NULL,
  leg_index integer NOT NULL,
  athlete_id integer,
  firstname text NOT NULL,
  surname text NOT NULL,
  organization text NOT NULL DEFAULT '',
  organization_id integer,
  athlete_key text NOT NULL,
  team_athlete_key text NOT NULL,
  age_class text NOT NULL DEFAULT '',
  event_name text NOT NULL DEFAULT '',
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (competition_id, event_id, team_alloc_id, leg_index)
);

CREATE INDEX relay_legs_comp_event_idx ON public.relay_legs (competition_id, event_id);
CREATE INDEX relay_legs_team_idx ON public.relay_legs (team_athlete_key, competition_id, event_id);
CREATE INDEX relay_legs_athlete_idx ON public.relay_legs (athlete_key);

GRANT SELECT ON public.relay_legs TO anon;
GRANT SELECT ON public.relay_legs TO authenticated;
GRANT ALL ON public.relay_legs TO service_role;

ALTER TABLE public.relay_legs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "relay_legs read for all"
  ON public.relay_legs FOR SELECT
  TO anon, authenticated
  USING (true);
