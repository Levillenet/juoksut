CREATE OR REPLACE FUNCTION public.get_hot_competition_ids(_window interval DEFAULT '00:30:00'::interval)
RETURNS SETOF integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH today_comps AS (
    SELECT hc.competition_id,
           hc.competition_date AS start_at,
           coalesce(hc.last_event_date,
             (hc.competition_date AT TIME ZONE 'Europe/Helsinki')::date) AS end_date,
           hc.exists_in_source
    FROM public.harvest_competitions hc
    WHERE hc.exists_in_source = true
      AND (now() AT TIME ZONE 'Europe/Helsinki')::date
          BETWEEN (hc.competition_date AT TIME ZONE 'Europe/Helsinki')::date
              AND coalesce(hc.last_event_date,
                (hc.competition_date AT TIME ZONE 'Europe/Helsinki')::date)
  ),
  activity AS (
    SELECT ar.competition_id, max(ar.captured_at) AS last_capture
    FROM public.athlete_results ar
    WHERE ar.competition_id IN (SELECT competition_id FROM today_comps)
    GROUP BY ar.competition_id
  ),
  user_selected AS (
    SELECT DISTINCT (u.raw_user_meta_data ->> 'last_competition_id')::int AS competition_id
    FROM auth.users u
    WHERE u.raw_user_meta_data ? 'last_competition_id'
      AND (u.raw_user_meta_data ->> 'last_competition_id') ~ '^[0-9]+$'
  ),
  recently_viewed AS (
    SELECT DISTINCT (ae.metadata ->> 'competition_id')::int AS competition_id
    FROM public.analytics_events ae
    WHERE ae.created_at > now() - _window
      AND ae.metadata ? 'competition_id'
      AND (ae.metadata ->> 'competition_id') ~ '^[0-9]+$'
      AND ae.event_name IN ('scoreboard_view', 'round_view', 'announcer_view', 'running_ops_view')
    UNION
    SELECT DISTINCT substring(ae.path from '/scoreboard.*[?&]competitionId=([0-9]+)')::int AS competition_id
    FROM public.analytics_events ae
    WHERE ae.created_at > now() - _window
      AND ae.path LIKE '/scoreboard%competitionId=%'
  ),
  followed AS (
    SELECT competition_id FROM user_selected
    UNION
    SELECT competition_id FROM recently_viewed WHERE competition_id IS NOT NULL
  )
  SELECT tc.competition_id
  FROM today_comps tc
  LEFT JOIN activity a USING (competition_id)
  WHERE tc.competition_id IN (SELECT competition_id FROM followed)
    AND (
      ((now() AT TIME ZONE 'Europe/Helsinki')::date
         = (tc.start_at AT TIME ZONE 'Europe/Helsinki')::date
        AND now() >= tc.start_at - interval '5 minutes'
        AND now() <= tc.start_at + interval '2 hours')
      OR ((now() AT TIME ZONE 'Europe/Helsinki')::date
            > (tc.start_at AT TIME ZONE 'Europe/Helsinki')::date
          AND EXTRACT(hour FROM now() AT TIME ZONE 'Europe/Helsinki') BETWEEN 8 AND 21)
      OR (a.last_capture IS NOT NULL AND a.last_capture > now() - _window)
    )
  ORDER BY coalesce(a.last_capture, tc.start_at) DESC
  LIMIT 4;
$$;