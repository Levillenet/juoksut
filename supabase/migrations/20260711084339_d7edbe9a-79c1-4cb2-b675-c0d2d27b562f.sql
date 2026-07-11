
-- Indeksi kuumien kilpailujen tunnistamiseen (max(captured_at) per competition_id)
CREATE INDEX IF NOT EXISTS idx_athlete_results_comp_captured
  ON public.athlete_results (competition_id, captured_at DESC);

-- Palauttaa kilpailu-ID:t jotka ovat parhaillaan käynnissä:
-- olemassa lähteessä, ei valmiiksi merkitty, ja saanut uuden/päivittyneen
-- tuloksen viimeisen _window aikaikkunan sisällä.
CREATE OR REPLACE FUNCTION public.get_hot_competition_ids(_window interval DEFAULT interval '30 minutes')
RETURNS SETOF integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ar.competition_id
  FROM public.athlete_results ar
  JOIN public.harvest_competitions hc USING (competition_id)
  WHERE hc.done = false
    AND hc.exists_in_source = true
    AND ar.competition_id IS NOT NULL
  GROUP BY ar.competition_id
  HAVING max(ar.captured_at) > now() - _window
  ORDER BY max(ar.captured_at) DESC
  LIMIT 20
$$;

-- Poista mahdollinen edellinen versio
DO $$
BEGIN
  PERFORM cron.unschedule('harvest-hot-15s');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Ajastus: 15 s välein. Kutsuu harvester-endpointtia vain jos kuumia ID:itä
-- on ja harvester ei ole estotilassa. Muuten cron ei tee mitään verkkokutsua.
SELECT cron.schedule(
  'harvest-hot-15s',
  '15 seconds',
  $cron$
  WITH hot AS (
    SELECT string_agg(id::text, ',') AS ids
    FROM public.get_hot_competition_ids(interval '30 minutes') AS id
  ),
  state AS (
    SELECT blocked FROM public.harvest_state WHERE id = 'singleton'
  )
  SELECT net.http_post(
    url := 'https://project--293ee435-938e-49f8-9f0c-88f8952d582f.lovable.app/api/public/hooks/harvest-results?ids=' || hot.ids,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 12000
  )
  FROM hot LEFT JOIN state ON true
  WHERE hot.ids IS NOT NULL
    AND (state.blocked IS DISTINCT FROM true);
  $cron$
);
