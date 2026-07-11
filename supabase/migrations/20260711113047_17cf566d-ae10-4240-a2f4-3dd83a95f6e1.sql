CREATE OR REPLACE FUNCTION public.get_hot_competition_ids(_window interval DEFAULT '00:30:00'::interval)
 RETURNS SETOF integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH today_comps AS (
    SELECT DISTINCT ar.competition_id,
           coalesce(hc.competition_date, ar.competition_date) AS start_at,
           coalesce(hc.exists_in_source, true) AS exists_in_source
    FROM public.athlete_results ar
    LEFT JOIN public.harvest_competitions hc USING (competition_id)
    WHERE ar.competition_id IS NOT NULL
      AND (coalesce(hc.competition_date, ar.competition_date) AT TIME ZONE 'Europe/Helsinki')::date
          = (now() AT TIME ZONE 'Europe/Helsinki')::date
  ),
  activity AS (
    SELECT ar.competition_id, max(ar.captured_at) AS last_capture
    FROM public.athlete_results ar
    WHERE ar.competition_id IN (SELECT competition_id FROM today_comps)
    GROUP BY ar.competition_id
  )
  SELECT tc.competition_id
  FROM today_comps tc
  LEFT JOIN activity a USING (competition_id)
  WHERE tc.exists_in_source = true
    AND (
      -- 5 min ennen alkamista, 2 h alkamisen jälkeen
      (now() >= tc.start_at - interval '5 minutes'
        AND now() <= tc.start_at + interval '2 hours')
      -- tai kilpailussa on ollut tulospäivityksiä viimeisen _window aikana
      OR (a.last_capture IS NOT NULL AND a.last_capture > now() - _window)
    )
  ORDER BY coalesce(a.last_capture, tc.start_at) DESC
  LIMIT 8;
$function$;