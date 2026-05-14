CREATE TABLE public.athlete_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_key text NOT NULL,
  surname text NOT NULL,
  firstname text NOT NULL,
  organization text NOT NULL DEFAULT '',
  organization_id integer,
  competition_id integer NOT NULL,
  competition_name text NOT NULL DEFAULT '',
  competition_date timestamptz,
  location text NOT NULL DEFAULT '',
  event_id integer NOT NULL,
  event_name text NOT NULL DEFAULT '',
  sub_category text NOT NULL DEFAULT '',
  event_category text NOT NULL DEFAULT '',
  result_text text NOT NULL DEFAULT '',
  result_numeric double precision,
  result_rank integer,
  wind double precision,
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_key, competition_id, event_id)
);

CREATE INDEX athlete_results_athlete_key_idx ON public.athlete_results (athlete_key);
CREATE INDEX athlete_results_org_id_idx ON public.athlete_results (organization_id);
CREATE INDEX athlete_results_event_idx ON public.athlete_results (event_name, sub_category);

ALTER TABLE public.athlete_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read athlete results"
  ON public.athlete_results FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert athlete results"
  ON public.athlete_results FOR INSERT TO authenticated WITH CHECK (true);
