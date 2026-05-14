
CREATE TABLE public.organization_locations (
  organization_id integer PRIMARY KEY,
  organization_name text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  lat double precision,
  lng double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read org locations"
  ON public.organization_locations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert org locations"
  ON public.organization_locations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update org locations"
  ON public.organization_locations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.competition_locations (
  competition_id integer PRIMARY KEY,
  location text NOT NULL DEFAULT '',
  lat double precision,
  lng double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.competition_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read competition locations"
  ON public.competition_locations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert competition locations"
  ON public.competition_locations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update competition locations"
  ON public.competition_locations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
