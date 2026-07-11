CREATE OR REPLACE FUNCTION public.get_hot_competition_ids(_window interval DEFAULT '02:00:00'::interval)
 RETURNS SETOF integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ar.competition_id
  FROM public.athlete_results ar
  LEFT JOIN public.harvest_competitions hc USING (competition_id)
  WHERE ar.competition_id IS NOT NULL
    AND coalesce(hc.exists_in_source, true) = true
    AND (coalesce(hc.competition_date, ar.competition_date) AT TIME ZONE 'Europe/Helsinki')::date
        = (now() AT TIME ZONE 'Europe/Helsinki')::date
  GROUP BY ar.competition_id
  HAVING max(ar.captured_at) > now() - _window
  ORDER BY max(ar.captured_at) DESC
  LIMIT 8;
$function$;