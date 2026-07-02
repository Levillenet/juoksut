
SET lock_timeout = '4s';
SET deadlock_timeout = '500ms';

DO $$
DECLARE
  cid integer;
  errcount integer := 0;
  okcount integer := 0;
BEGIN
  FOR cid IN
    SELECT DISTINCT competition_id
    FROM public.athlete_results
    WHERE competition_date >= '2026-06-12'
      AND competition_id IS NOT NULL
    ORDER BY competition_id
  LOOP
    BEGIN
      PERFORM public.mark_pbs_for_competitions(ARRAY[cid]::integer[]);
      okcount := okcount + 1;
    EXCEPTION WHEN OTHERS THEN
      errcount := errcount + 1;
      RAISE NOTICE 'skip comp %: %', cid, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'mark_pbs done: ok=% err=%', okcount, errcount;
END $$;
