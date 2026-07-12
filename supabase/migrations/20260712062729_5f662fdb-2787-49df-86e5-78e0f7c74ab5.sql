ALTER TABLE public.harvest_competitions
  ADD COLUMN IF NOT EXISTS last_event_date date;

-- Alustava täyttö: käytetään aloituspäivää (Helsinki), oikea arvo päivittyy
-- harvesterin seuraavalla ajolla.
UPDATE public.harvest_competitions
SET last_event_date = (competition_date AT TIME ZONE 'Europe/Helsinki')::date
WHERE last_event_date IS NULL
  AND competition_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS harvest_competitions_last_event_date_idx
  ON public.harvest_competitions (last_event_date);

CREATE OR REPLACE FUNCTION public.is_any_competition_active_today()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.harvest_competitions hc
    WHERE hc.exists_in_source = true
      AND (now() AT TIME ZONE 'Europe/Helsinki')::date
          BETWEEN (hc.competition_date AT TIME ZONE 'Europe/Helsinki')::date
              AND coalesce(hc.last_event_date, (hc.competition_date AT TIME ZONE 'Europe/Helsinki')::date)
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_any_competition_active_today() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_hot_competition_ids(_window interval DEFAULT '00:30:00'::interval)
RETURNS SETOF integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
  watched_comps AS (
    SELECT DISTINCT ar.competition_id
    FROM public.watched_athletes wa
    JOIN public.athlete_results ar ON ar.athlete_key = wa.athlete_key
    WHERE ar.competition_id IN (SELECT competition_id FROM today_comps)
  ),
  followed AS (
    SELECT competition_id FROM user_selected
    UNION
    SELECT competition_id FROM watched_comps
  )
  SELECT tc.competition_id
  FROM today_comps tc
  LEFT JOIN activity a USING (competition_id)
  WHERE tc.competition_id IN (SELECT competition_id FROM followed)
    AND (
      -- Aloituspäivänä: 5 min ennen alkua, 2 h alun jälkeen tai kunnes tuloreknum vanhenee
      ((now() AT TIME ZONE 'Europe/Helsinki')::date
         = (tc.start_at AT TIME ZONE 'Europe/Helsinki')::date
        AND now() >= tc.start_at - interval '5 minutes'
        AND now() <= tc.start_at + interval '2 hours')
      -- Aloituspäivän jälkeisillä päivillä: kello 08–22 Helsinki
      OR ((now() AT TIME ZONE 'Europe/Helsinki')::date
            > (tc.start_at AT TIME ZONE 'Europe/Helsinki')::date
          AND EXTRACT(hour FROM now() AT TIME ZONE 'Europe/Helsinki') BETWEEN 8 AND 21)
      -- Aina jos on tuoretta aktiviteettia
      OR (a.last_capture IS NOT NULL AND a.last_capture > now() - _window)
    )
  ORDER BY coalesce(a.last_capture, tc.start_at) DESC
  LIMIT 8;
$$;