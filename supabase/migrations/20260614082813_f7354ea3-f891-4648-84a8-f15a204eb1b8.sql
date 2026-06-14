
CREATE OR REPLACE FUNCTION public.event_spec_suffix(event_name text, age_class text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  norm      text := lower(public.normalize_event_name(event_name));
  ac        text := upper(coalesce(age_class, ''));
  g         text;
  age_num   int;
  is_adult  boolean;
  dist      int;
  height_cm numeric;
  cnt       int;
  weight_g  int;
  kind      text;
BEGIN
  IF length(ac) = 0 THEN RETURN NULL; END IF;
  IF left(ac,1) IN ('T','N') THEN g := 'F';
  ELSIF left(ac,1) IN ('P','M') THEN g := 'M';
  ELSE RETURN NULL;
  END IF;
  age_num := nullif(regexp_replace(ac, '^[MNTP]', ''), '')::int;
  is_adult := (left(ac,1) IN ('M','N') AND (age_num IS NULL OR age_num >= 19))
              OR ac IN ('P19','P22','T19','T22');

  IF norm ~ 'aita|aidat|aitajuoksu|hurdle' THEN
    dist := (regexp_match(norm, '(\d{2,3})\s*m'))[1]::int;
    IF dist IS NULL THEN RETURN NULL; END IF;
    IF is_adult THEN
      IF g = 'F' THEN
        IF dist = 100 THEN height_cm := 84;   cnt := 10;
        ELSIF dist = 400 THEN height_cm := 76.2; cnt := 10;
        ELSIF dist = 60  THEN height_cm := 84;   cnt := 5;
        END IF;
      ELSE
        IF dist = 110 THEN height_cm := 106.7; cnt := 10;
        ELSIF dist = 400 THEN height_cm := 91.4;  cnt := 10;
        ELSIF dist = 60  THEN height_cm := 106.7; cnt := 5;
        END IF;
      END IF;
    END IF;
    IF height_cm IS NULL THEN
      SELECT h, c INTO height_cm, cnt FROM (VALUES
        ('F','T11', 60,  60.0::numeric,  8),
        ('F','T13', 60,  65.0,  8),
        ('F','T13', 80,  65.0,  8),
        ('F','T15', 80,  76.2,  8),
        ('F','T15',100,  76.2, 10),
        ('F','T17',100,  76.2, 10),
        ('F','T17',400,  76.2, 10),
        ('F','T17',300,  76.2,  7),
        ('M','P11', 60,  60.0,  8),
        ('M','P13', 60,  76.2,  8),
        ('M','P13', 80,  76.2,  8),
        ('M','P15',100,  84.0, 10),
        ('M','P15',300,  76.2,  7),
        ('M','P17',110,  91.4, 10),
        ('M','P17',400,  84.0, 10)
      ) AS t(g_,ac_,d_,h,c)
      WHERE t.g_ = g AND t.ac_ = ac AND t.d_ = dist;
    END IF;
    IF height_cm IS NOT NULL THEN
      RETURN 'H-' || dist || '-' || height_cm || '-' || cnt;
    END IF;
    RETURN 'ac:' || ac;
  END IF;

  IF norm ~ 'kuula|shot' THEN kind := 'shot';
  ELSIF norm ~ 'kiekko|discus' THEN kind := 'discus';
  ELSIF norm ~ 'keihäs|keihas|javelin' THEN kind := 'javelin';
  ELSIF norm ~ 'moukari|hammer' THEN kind := 'hammer';
  END IF;

  IF kind IS NOT NULL THEN
    IF is_adult AND left(ac,1) IN ('M','N') THEN
      IF g = 'F' THEN
        weight_g := CASE kind WHEN 'shot' THEN 4000 WHEN 'discus' THEN 1000
                              WHEN 'javelin' THEN 600 WHEN 'hammer' THEN 4000 END;
      ELSE
        weight_g := CASE kind WHEN 'shot' THEN 7260 WHEN 'discus' THEN 2000
                              WHEN 'javelin' THEN 800 WHEN 'hammer' THEN 7260 END;
      END IF;
    ELSIF ac IN ('T19','T22') THEN
      weight_g := CASE kind WHEN 'shot' THEN 4000 WHEN 'discus' THEN 1000
                            WHEN 'javelin' THEN 600 WHEN 'hammer' THEN 4000 END;
    ELSE
      SELECT w INTO weight_g FROM (VALUES
        ('T9','shot',1000),('T9','discus',600),
        ('T10','shot',1000),('T10','discus',600),
        ('T11','shot',2000),('T11','discus',600),
        ('T12','shot',2000),('T12','discus',600),
        ('T13','shot',3000),('T13','discus',600),('T13','javelin',400),('T13','hammer',3000),
        ('T14','shot',3000),('T14','discus',1000),('T14','javelin',400),('T14','hammer',3000),
        ('T15','shot',3000),('T15','discus',1000),('T15','javelin',500),('T15','hammer',3000),
        ('T16','shot',3000),('T16','discus',1000),('T16','javelin',500),('T16','hammer',3000),
        ('T17','shot',3000),('T17','discus',1000),('T17','javelin',500),('T17','hammer',4000),
        ('P9','shot',1000),('P9','discus',600),
        ('P10','shot',1500),('P10','discus',600),
        ('P11','shot',2000),('P11','discus',600),
        ('P12','shot',3000),('P12','discus',1000),
        ('P13','shot',3000),('P13','discus',1000),('P13','javelin',500),('P13','hammer',3000),
        ('P14','shot',4000),('P14','discus',1000),('P14','javelin',500),('P14','hammer',4000),
        ('P15','shot',4000),('P15','discus',1000),('P15','javelin',600),('P15','hammer',4000),
        ('P16','shot',5000),('P16','discus',1500),('P16','javelin',600),('P16','hammer',5000),
        ('P17','shot',5000),('P17','discus',1500),('P17','javelin',700),('P17','hammer',5000),
        ('P19','shot',6000),('P19','discus',1750),('P19','javelin',800),('P19','hammer',6000),
        ('P22','shot',6000),('P22','discus',2000),('P22','javelin',800),('P22','hammer',6000)
      ) AS t(ac_,k_,w)
      WHERE t.ac_ = ac AND t.k_ = kind;
    END IF;
    IF weight_g IS NOT NULL THEN
      RETURN 'T-' || kind || '-' || weight_g;
    END IF;
    RETURN 'ac:' || ac;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.event_pb_key(event_name text, age_class text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public.event_spec_suffix(event_name, age_class) IS NULL
      THEN public.normalize_event_name(event_name)
    ELSE public.normalize_event_name(event_name)
         || '|' || public.event_spec_suffix(event_name, age_class)
  END
$$;

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
      public.event_pb_key(ar.event_name, ar.age_class) AS pb_key
    FROM public.athlete_results ar
    WHERE ar.competition_id = ANY(comp_ids)
      AND ar.result_numeric IS NOT NULL
  ),
  all_rows AS (
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
    JOIN affected_pairs p
      ON p.athlete_key = ar.athlete_key
     AND p.pb_key = public.event_pb_key(ar.event_name, ar.age_class)
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
            AND prev.pb_key = r.pb_key
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
            AND prev.pb_key = r.pb_key
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
