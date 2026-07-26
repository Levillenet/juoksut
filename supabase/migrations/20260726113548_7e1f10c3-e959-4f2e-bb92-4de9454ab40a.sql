
CREATE OR REPLACE FUNCTION public.mark_pbs_for_competitions(comp_ids integer[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected integer := 0;
  keys text[];
BEGIN
  FOR keys IN
    SELECT array_agg(k)
    FROM (
      SELECT athlete_key AS k,
             ((row_number() OVER (ORDER BY athlete_key)) - 1) / 100 AS bucket
      FROM (
        SELECT DISTINCT athlete_key
        FROM public.athlete_results
        WHERE competition_id = ANY(comp_ids)
          AND result_numeric IS NOT NULL
      ) d
    ) b
    GROUP BY bucket
  LOOP
    affected := affected + public.mark_pbs_for_athletes(keys);
  END LOOP;
  RETURN affected;
END;
$function$;
