CREATE OR REPLACE FUNCTION public.prune_tuloslista_proxy_cache()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.tuloslista_proxy_cache
  WHERE cached_at < now() - interval '1 hour'
$$;

CREATE OR REPLACE FUNCTION public.daily_maintenance_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.tuloslista_proxy_cache WHERE cached_at < now() - interval '1 hour';
  DELETE FROM public.tuloslista_proxy_fetch_locks WHERE expires_at < now() - interval '1 hour';
  DELETE FROM public.harvest_locks WHERE expires_at < now() - interval '1 hour';
  DELETE FROM public.analytics_events WHERE created_at < now() - interval '180 days';
  DELETE FROM public.origin_call_path_daily WHERE day < current_date - 90;
  DELETE FROM public.tuloslista_probe_log WHERE checked_at < now() - interval '30 days';
END;
$$;

REVOKE ALL ON FUNCTION public.daily_maintenance_cleanup() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-maintenance-cleanup') THEN
    PERFORM cron.unschedule('daily-maintenance-cleanup');
  END IF;
END;
$$;

SELECT cron.schedule(
  'daily-maintenance-cleanup',
  '20 3 * * *',
  $cron$ SELECT public.daily_maintenance_cleanup(); $cron$
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tuloslista-monitor') THEN
    PERFORM cron.unschedule('tuloslista-monitor');
  END IF;
END;
$$;

SELECT cron.schedule(
  'tuloslista-monitor',
  '*/30 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--293ee435-938e-49f8-9f0c-88f8952d582f.lovable.app/api/public/hooks/monitor-tuloslista',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  )
  WHERE EXTRACT(HOUR FROM now() AT TIME ZONE 'Europe/Helsinki') >= 9
    AND EXTRACT(HOUR FROM now() AT TIME ZONE 'Europe/Helsinki') < 21;
  $cron$
);