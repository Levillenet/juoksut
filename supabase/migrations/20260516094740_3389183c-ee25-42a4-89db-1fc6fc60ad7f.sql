CREATE OR REPLACE FUNCTION public.mark_pbs_for_competitions(comp_ids integer[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected integer;
BEGIN
  WITH affected_pairs AS (
    SELECT DISTINCT
      ar.athlete_key,
      public.normalize_event_name(ar.event_name) AS norm_event
    FROM public.athlete_results ar
    WHERE ar.competition_id = ANY(comp_ids)
      AND ar.result_numeric IS NOT NULL
  ),
  all_rows AS (
    SELECT
      ar.id,
      ar.was_pb AS current_pb,
      ar.athlete_key,
      public.normalize_event_name(ar.event_name) AS norm_event,
      ar.event_category,
      ar.result_numeric,
      ar.competition_date,
      ar.captured_at
    FROM public.athlete_results ar
    JOIN affected_pairs p
      ON p.athlete_key = ar.athlete_key
     AND p.norm_event = public.normalize_event_name(ar.event_name)
    WHERE ar.result_numeric IS NOT NULL
  ),
  computed AS (
    SELECT
      r.id,
      r.current_pb,
      CASE
        WHEN r.event_category = 'Track' THEN NOT EXISTS (
          SELECT 1 FROM all_rows prev
          WHERE prev.athlete_key = r.athlete_key
            AND prev.norm_event = r.norm_event
            AND prev.id <> r.id
            AND prev.result_numeric <= r.result_numeric
            AND (
              prev.competition_date < r.competition_date
              OR (prev.competition_date = r.competition_date AND prev.captured_at < r.captured_at)
              OR (prev.competition_date = r.competition_date AND prev.captured_at = r.captured_at AND prev.id < r.id)
            )
        )
        ELSE NOT EXISTS (
          SELECT 1 FROM all_rows prev
          WHERE prev.athlete_key = r.athlete_key
            AND prev.norm_event = r.norm_event
            AND prev.id <> r.id
            AND prev.result_numeric >= r.result_numeric
            AND (
              prev.competition_date < r.competition_date
              OR (prev.competition_date = r.competition_date AND prev.captured_at < r.captured_at)
              OR (prev.competition_date = r.competition_date AND prev.captured_at = r.captured_at AND prev.id < r.id)
            )
        )
      END AS new_pb
    FROM all_rows r
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

REVOKE EXECUTE ON FUNCTION public.mark_pbs_for_competitions(integer[]) FROM PUBLIC, anon, authenticated;