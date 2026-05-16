
-- Korjaa suomalaisten aikaformaattien parsinta jo tallennetuissa riveissä.
-- Käsiteltävät muodot:
--   "M.SS,xx"  esim. "4.42,40"  → 4*60 + 42 + 0.40 = 282.40
--   "H.MM.SS,xx" esim. "1.02.30,5" → 3750.5
--   "M,SS"     esim. "4,18"     → 258  (vain juoksuissa, matka ≥ 600 m)
--
-- Vaikuttaa vain riveihin joiden result_numeric on selvästi väärin
-- nykyisellä parsinnalla.

CREATE OR REPLACE FUNCTION public.fix_running_times_numeric()
RETURNS TABLE(updated_count integer, affected_competitions integer[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
  v_comps integer[];
BEGIN
  WITH candidates AS (
    SELECT
      id,
      competition_id,
      result_text,
      result_numeric AS old_numeric,
      event_name,
      sub_category,
      event_category,
      -- Päättele matka m:nä lajinimestä
      (CASE
        -- "1km", "2 km"
        WHEN event_name ~* '(\d+(?:[.,]\d+)?)\s*km\b' THEN
          (regexp_match(event_name, '(\d+(?:[.,]\d+)?)\s*km\b', 'i'))[1]::numeric * 1000
        -- "1000m", "60m", "800 m" (vähintään 2 numeroa, jotta "P10" yms ei matchaa)
        WHEN event_name ~* '(\d{2,5})\s*m\b' THEN
          (regexp_match(event_name, '(\d{2,5})\s*m\b', 'i'))[1]::numeric
        ELSE NULL
      END) AS distance_m,
      -- "M.SS,xx" tai "H.MM.SS,xx" — sisältää sekä '.' että ','
      (result_text ~ '^\d+(\.\d+)+,\d+$') AS is_minsec_decimal,
      -- "M,SS" — vain pilkku, kaksi numeroa molemmilla puolilla (SS 00–59)
      (result_text ~ '^\d+,\d{2}$') AS is_minsec_short
    FROM public.athlete_results
    WHERE result_text IS NOT NULL
      AND result_text <> ''
      AND (
        sub_category IN ('Run','Sprint','MiddleDistance','LongDistance','Hurdles','Steeple','Relay','Walk','RoadRun','CrossCountry')
        OR event_category = 'Track'
      )
  ),
  parsed AS (
    SELECT
      id,
      competition_id,
      old_numeric,
      CASE
        -- "M.SS,xx" / "H.MM.SS,xx": jaa pilkulla → intPart + fracPart
        WHEN is_minsec_decimal THEN (
          SELECT
            -- units kerätään pisteen erotuksella ja kerrotaan 60:llä
            (SELECT SUM(u::numeric * power(60, units.n - row_idx)::numeric)
             FROM (
               SELECT u, row_number() OVER () AS row_idx, COUNT(*) OVER () AS n
               FROM unnest(string_to_array(split_part(result_text, ',', 1), '.')) AS u
             ) units
            ) + ('0.' || split_part(result_text, ',', 2))::numeric
        )
        -- "M,SS": vain juoksu + matka ≥ 600 m, SS 00–59
        WHEN is_minsec_short
             AND distance_m IS NOT NULL
             AND distance_m >= 600
             AND split_part(result_text, ',', 2)::int BETWEEN 0 AND 59
        THEN
          split_part(result_text, ',', 1)::numeric * 60
          + split_part(result_text, ',', 2)::numeric
        ELSE NULL
      END AS new_numeric
    FROM candidates
  ),
  changes AS (
    SELECT id, competition_id, new_numeric
    FROM parsed
    WHERE new_numeric IS NOT NULL
      AND (old_numeric IS NULL OR ABS(new_numeric - old_numeric) > 0.005)
  ),
  updated AS (
    UPDATE public.athlete_results ar
    SET result_numeric = c.new_numeric
    FROM changes c
    WHERE ar.id = c.id
    RETURNING ar.competition_id
  )
  SELECT COUNT(*)::int, ARRAY(SELECT DISTINCT competition_id FROM updated)
  INTO v_updated, v_comps;

  RETURN QUERY SELECT v_updated, v_comps;
END;
$$;
