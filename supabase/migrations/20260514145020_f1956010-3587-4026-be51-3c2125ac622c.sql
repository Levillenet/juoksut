CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedule with the same name (safe re-run)
DO $$
BEGIN
  PERFORM cron.unschedule('harvest-tuloslista-nightly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$$;

-- Schedule nightly at 03:15 UTC (= 05:15 / 06:15 Helsinki)
SELECT cron.schedule(
  'harvest-tuloslista-nightly',
  '15 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--293ee435-938e-49f8-9f0c-88f8952d582f.lovable.app/api/public/hooks/harvest-results',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);