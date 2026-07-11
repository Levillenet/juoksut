DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'harvest-tuloslista') THEN
    PERFORM cron.unschedule('harvest-tuloslista');
  END IF;
END $$;

SELECT cron.schedule(
  'harvest-tuloslista',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--293ee435-938e-49f8-9f0c-88f8952d582f.lovable.app/api/public/hooks/harvest-results',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxaGx3amdnb3RwYndmdnZ4bG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MzY2MDcsImV4cCI6MjA5NDMxMjYwN30.EmQG-MIpvjk6j-FK_DJFDN9iKJSAWEyFIzzy6YpaXWE"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);