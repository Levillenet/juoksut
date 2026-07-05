
CREATE OR REPLACE FUNCTION public.district_event_match_key(event_name text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  s text;
BEGIN
  s := lower(coalesce(event_name, ''));
  -- Poista ikäluokka-etuliite
  s := regexp_replace(s, '^\s*[mntp][0-9]*\s+', '');
  -- Normalisoi väli numeron ja "m"-yksikön välissä (100m -> 100 m)
  s := regexp_replace(s, '(\d)\s*m\b', '\1 m', 'g');
  -- Yhtenäistä aitatermi
  s := regexp_replace(s, '\baidat\b', 'aj', 'g');
  -- Kävelyn lyhenne
  s := regexp_replace(s, '\bkäv\.', 'kävely', 'g');
  -- Poista tuplavälit
  s := regexp_replace(s, '\s+', ' ', 'g');
  RETURN trim(s);
END;
$$;

-- Ajaa backfillin uudelleen korjatun matchingin kanssa
DO $$
DECLARE
  r record;
  cnt int := 0;
BEGIN
  -- Tyhjennä aiemmat murtumat ja resetoi ennnennätystulokset alkuperäisistä lähtöarvoista
  DELETE FROM public.district_record_breaks;
  UPDATE public.athlete_results SET was_district_record = false WHERE was_district_record = true;

  FOR r IN
    SELECT ar.id
    FROM public.athlete_results ar
    JOIN public.lahti_district_clubs c ON c.club_name = ar.organization
    WHERE ar.result_numeric IS NOT NULL
      AND ar.age_class IS NOT NULL
      AND ar.competition_date >= now() - interval '5 years'
    ORDER BY ar.competition_date ASC, ar.captured_at ASC
  LOOP
    IF public.check_district_record(r.id) THEN
      cnt := cnt + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'Backfill: % piiriennätystä rikottu', cnt;
END $$;
