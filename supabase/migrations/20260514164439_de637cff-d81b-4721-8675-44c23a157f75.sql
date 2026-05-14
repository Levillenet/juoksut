CREATE OR REPLACE FUNCTION public.mark_pbs_for_competitions(comp_ids integer[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  WITH targets AS (
    SELECT
      ar.id,
      ar.athlete_key,
      public.normalize_event_name(ar.event_name) AS norm_event,
      ar.event_category,
      ar.result_numeric,
      ar.captured_at
    FROM public.athlete_results ar
    WHERE ar.competition_id = ANY(comp_ids)
      AND ar.result_numeric IS NOT NULL
      AND ar.was_pb = false
  ),
  to_flag AS (
    SELECT t.id
    FROM targets t
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.athlete_results prev
      WHERE prev.athlete_key = t.athlete_key
        AND public.normalize_event_name(prev.event_name) = t.norm_event
        AND prev.result_numeric IS NOT NULL
        AND prev.id <> t.id
        AND (
          prev.captured_at < t.captured_at
          OR (prev.captured_at = t.captured_at AND prev.id < t.id)
        )
        AND (
          (t.event_category = 'Track' AND prev.result_numeric <= t.result_numeric)
          OR (t.event_category <> 'Track' AND prev.result_numeric >= t.result_numeric)
        )
    )
  )
  UPDATE public.athlete_results ar
  SET was_pb = true
  FROM to_flag f
  WHERE ar.id = f.id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;