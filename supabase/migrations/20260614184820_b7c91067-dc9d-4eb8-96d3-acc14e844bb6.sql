CREATE TABLE public.event_duration_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  sub_category TEXT NOT NULL DEFAULT '',
  n_samples INTEGER NOT NULL DEFAULT 0,
  median_duration_min REAL,
  p90_duration_min REAL,
  median_participants REAL,
  max_participants INTEGER,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_duration_stats_unique UNIQUE (event_name, group_name)
);

CREATE INDEX event_duration_stats_lookup_idx
  ON public.event_duration_stats (event_name, group_name);

CREATE INDEX event_duration_stats_samples_idx
  ON public.event_duration_stats (n_samples DESC);

GRANT SELECT ON public.event_duration_stats TO authenticated;
GRANT ALL ON public.event_duration_stats TO service_role;

ALTER TABLE public.event_duration_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read duration stats"
  ON public.event_duration_stats
  FOR SELECT
  TO authenticated
  USING (true);
