DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'harvest-tuloslista') THEN
    PERFORM cron.unschedule('harvest-tuloslista');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'harvest-hot-15s') THEN
    PERFORM cron.unschedule('harvest-hot-15s');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tuloslista-monitor') THEN
    PERFORM cron.unschedule('tuloslista-monitor');
  END IF;
END $$;

SELECT cron.schedule(
  'harvest-tuloslista',
  '*/5 9-20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--293ee435-938e-49f8-9f0c-88f8952d582f.lovable.app/api/public/hooks/harvest-results',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'harvest-hot-15s',
  '*/1 9-20 * * *',
  $$
  WITH hot AS (
    SELECT string_agg(id::text, ',') AS ids
    FROM public.get_hot_competition_ids() AS id
  )
  SELECT net.http_post(
    url := 'https://project--293ee435-938e-49f8-9f0c-88f8952d582f.lovable-project.com/api/public/hooks/harvest-results?ids=' || hot.ids,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  )
  FROM hot
  WHERE hot.ids IS NOT NULL AND hot.ids <> '';
  $$
);

SELECT cron.schedule(
  'tuloslista-monitor',
  '*/10 9-20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--293ee435-938e-49f8-9f0c-88f8952d582f.lovable-project.com/api/public/hooks/monitor-tuloslista',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);