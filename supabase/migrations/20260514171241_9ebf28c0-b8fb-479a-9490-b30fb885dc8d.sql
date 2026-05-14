CREATE TABLE public.harvest_competitions (
  competition_id integer PRIMARY KEY,
  competition_date timestamptz,
  row_count integer NOT NULL DEFAULT 0,
  exists_in_source boolean NOT NULL DEFAULT false,
  done boolean NOT NULL DEFAULT false,
  last_scanned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_harvest_competitions_revisit
  ON public.harvest_competitions (last_scanned_at)
  WHERE done = false;

ALTER TABLE public.harvest_competitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read harvest competitions"
  ON public.harvest_competitions FOR SELECT
  TO authenticated USING (true);
