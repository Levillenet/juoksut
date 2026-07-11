CREATE OR REPLACE FUNCTION public.harvest_try_lock()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT pg_try_advisory_lock(hashtext('harvest-tuloslista')::bigint);
$function$;

CREATE OR REPLACE FUNCTION public.harvest_unlock()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT pg_advisory_unlock(hashtext('harvest-tuloslista')::bigint);
$function$;

REVOKE ALL ON FUNCTION public.harvest_try_lock() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.harvest_unlock() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.harvest_try_lock() TO service_role;
GRANT EXECUTE ON FUNCTION public.harvest_unlock() TO service_role;

CREATE OR REPLACE FUNCTION public.get_hot_competition_ids(_window interval DEFAULT '00:30:00'::interval)
RETURNS SETOF integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ar.competition_id
  FROM public.athlete_results ar
  JOIN public.harvest_competitions hc USING (competition_id)
  WHERE hc.done = false
    AND hc.exists_in_source = true
    AND ar.competition_id IS NOT NULL
    AND coalesce(hc.competition_date, ar.competition_date) >= ((now() AT TIME ZONE 'Europe/Helsinki')::date - 1)
    AND coalesce(hc.competition_date, ar.competition_date) <  ((now() AT TIME ZONE 'Europe/Helsinki')::date + 2)
  GROUP BY ar.competition_id
  HAVING max(ar.captured_at) > now() - _window
  ORDER BY max(ar.captured_at) DESC
  LIMIT 8
$function$;

UPDATE public.harvest_competitions
SET done = true
WHERE done = false
  AND exists_in_source = true
  AND competition_date < ((now() AT TIME ZONE 'Europe/Helsinki')::date - 1);