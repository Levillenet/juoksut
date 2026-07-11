DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'harvest-hot-15s') THEN
    PERFORM cron.unschedule('harvest-hot-15s');
  END IF;
END $$;

SELECT cron.schedule(
  'harvest-hot-15s',
  '*/1 * * * *',
  $$
  WITH hot AS (
    SELECT string_agg(id::text, ',') AS ids
    FROM public.get_hot_competition_ids() AS id
  )
  SELECT net.http_post(
    url := 'https://project--293ee435-938e-49f8-9f0c-88f8952d582f.lovable.app/api/public/hooks/harvest-results?ids=' || hot.ids,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  )
  FROM hot
  WHERE hot.ids IS NOT NULL AND hot.ids <> '';
  $$
);