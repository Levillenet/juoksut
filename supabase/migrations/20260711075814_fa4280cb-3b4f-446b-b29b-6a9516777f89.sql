
ALTER TABLE public.tuloslista_probe_log
  ADD COLUMN IF NOT EXISTS endpoint text NOT NULL DEFAULT 'list';

CREATE INDEX IF NOT EXISTS tuloslista_probe_log_endpoint_idx
  ON public.tuloslista_probe_log (endpoint, id DESC);

ALTER TABLE public.harvest_state
  ADD COLUMN IF NOT EXISTS consecutive_result_failures integer NOT NULL DEFAULT 0;
