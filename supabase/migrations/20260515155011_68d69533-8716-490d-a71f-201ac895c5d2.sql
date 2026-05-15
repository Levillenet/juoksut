
CREATE TABLE public.external_competitions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL DEFAULT 'kilpailukalenteri',
  source_id integer NOT NULL,
  name text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  classification text NOT NULL DEFAULT '',
  start_date date NOT NULL,
  end_date date,
  registration_deadline text NOT NULL DEFAULT '',
  organizer text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  raw jsonb,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);

CREATE INDEX idx_external_competitions_start_date ON public.external_competitions (start_date);
CREATE INDEX idx_external_competitions_classification ON public.external_competitions (classification);

ALTER TABLE public.external_competitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read external competitions"
  ON public.external_competitions FOR SELECT
  TO authenticated USING (true);

CREATE TRIGGER update_external_competitions_updated_at
  BEFORE UPDATE ON public.external_competitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.external_harvest_state (
  id text NOT NULL DEFAULT 'kilpailukalenteri' PRIMARY KEY,
  last_run_at timestamptz,
  last_status text NOT NULL DEFAULT '',
  scanned_count integer NOT NULL DEFAULT 0,
  upserted_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.external_harvest_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read external harvest state"
  ON public.external_harvest_state FOR SELECT
  TO authenticated USING (true);

INSERT INTO public.external_harvest_state (id) VALUES ('kilpailukalenteri')
  ON CONFLICT (id) DO NOTHING;
