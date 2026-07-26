
CREATE OR REPLACE FUNCTION public.mark_pbs_for_athletes(athlete_keys text[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected integer;
BEGIN
  WITH all_rows AS (
    SELECT
      ar.id,
      ar.was_pb AS current_pb,
      ar.athlete_key,
      public.event_pb_key(ar.event_name, ar.age_class) AS pb_key,
      ar.event_category,
      ar.result_numeric,
      ar.competition_date,
      ar.captured_at
    FROM public.athlete_results ar
    WHERE ar.athlete_key = ANY(athlete_keys)
      AND ar.result_numeric IS NOT NULL
  ),
  windowed AS (
    SELECT
      r.id,
      r.current_pb,
      r.event_category,
      r.result_numeric,
      r.competition_date,
      CASE WHEN r.competition_date IS NULL THEN NULL ELSE
        min(CASE WHEN r.competition_date IS NULL THEN NULL ELSE r.result_numeric END)
          OVER (PARTITION BY r.athlete_key, r.pb_key
                ORDER BY r.competition_date NULLS FIRST, r.captured_at, r.id
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)
      END AS prev_min,
      CASE WHEN r.competition_date IS NULL THEN NULL ELSE
        max(CASE WHEN r.competition_date IS NULL THEN NULL ELSE r.result_numeric END)
          OVER (PARTITION BY r.athlete_key, r.pb_key
                ORDER BY r.competition_date NULLS FIRST, r.captured_at, r.id
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)
      END AS prev_max
    FROM all_rows r
  ),
  computed AS (
    SELECT
      w.id,
      w.current_pb,
      CASE
        WHEN w.event_category = 'Track'
          THEN (w.prev_min IS NULL OR w.prev_min > w.result_numeric)
        ELSE (w.prev_max IS NULL OR w.prev_max < w.result_numeric)
      END AS new_pb
    FROM windowed w
  ),
  changed AS (
    SELECT id, new_pb FROM computed WHERE new_pb IS DISTINCT FROM current_pb
  )
  UPDATE public.athlete_results ar
  SET was_pb = c.new_pb
  FROM changed c
  WHERE ar.id = c.id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_pbs_for_competitions(comp_ids integer[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected integer := 0;
  batch integer;
  keys text[];
BEGIN
  FOR keys IN
    SELECT array_agg(k)
    FROM (
      SELECT athlete_key AS k,
             ntile(GREATEST(1, (SELECT COUNT(DISTINCT athlete_key)
                                FROM public.athlete_results
                                WHERE competition_id = ANY(comp_ids)
                                  AND result_numeric IS NOT NULL) / 100 + 1))
               OVER (ORDER BY athlete_key) AS bucket
      FROM (
        SELECT DISTINCT athlete_key
        FROM public.athlete_results
        WHERE competition_id = ANY(comp_ids)
          AND result_numeric IS NOT NULL
      ) d
    ) b
    GROUP BY bucket
  LOOP
    batch := public.mark_pbs_for_athletes(keys);
    affected := affected + batch;
  END LOOP;
  RETURN affected;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_pbs_for_athletes(text[]) TO service_role;
