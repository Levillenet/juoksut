
ALTER TABLE public.harvest_state
  ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS block_reason text,
  ADD COLUMN IF NOT EXISTS block_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS block_since timestamptz;

CREATE TABLE IF NOT EXISTS public.tuloslista_probe_log (
  id bigserial PRIMARY KEY,
  checked_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL,
  status integer NOT NULL,
  duration_ms integer NOT NULL,
  content_type text,
  body_bytes integer NOT NULL DEFAULT 0,
  body_preview text,
  reason text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS tuloslista_probe_log_checked_at_idx
  ON public.tuloslista_probe_log (checked_at DESC);

GRANT SELECT ON public.tuloslista_probe_log TO authenticated;
GRANT ALL ON public.tuloslista_probe_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.tuloslista_probe_log_id_seq TO service_role;

ALTER TABLE public.tuloslista_probe_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read tuloslista probe log" ON public.tuloslista_probe_log;
CREATE POLICY "Authenticated can read tuloslista probe log"
  ON public.tuloslista_probe_log FOR SELECT TO authenticated USING (true);

DO $$
BEGIN
  PERFORM cron.unschedule('tuloslista-monitor');
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$$;

SELECT cron.schedule(
  'tuloslista-monitor',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--293ee435-938e-49f8-9f0c-88f8952d582f.lovable.app/api/public/hooks/monitor-tuloslista',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
