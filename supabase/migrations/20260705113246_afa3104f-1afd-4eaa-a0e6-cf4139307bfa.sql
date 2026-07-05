
-- Yksinkertainen vertailuavain: lowercase normalisoitu lajinimi
CREATE OR REPLACE FUNCTION public.district_event_match_key(event_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(trim(regexp_replace(
    regexp_replace(coalesce(event_name, ''), '^(?:[MNTPmntp][0-9]*)\s+', ''),
    '\s+', ' ', 'g'
  )))
$$;

-- Onko tulos parempi kuin ennätys?
-- Juoksuissa/aidoissa/kävelyssä pienempi = parempi. Kentissä suurempi = parempi.
CREATE OR REPLACE FUNCTION public.is_better_result(new_val double precision, old_val double precision, event_category text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN new_val IS NULL OR old_val IS NULL THEN false
    WHEN event_category = 'Track' THEN new_val < old_val
    ELSE new_val > old_val
  END
$$;

-- Tarkista yksittäinen tulos piiriennätystä vasten
CREATE OR REPLACE FUNCTION public.check_district_record(_result_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.athlete_results;
  dr public.district_records;
  match_key text;
  is_district_club boolean;
BEGIN
  SELECT * INTO r FROM public.athlete_results WHERE id = _result_id;
  IF NOT FOUND OR r.result_numeric IS NULL OR r.age_class IS NULL OR r.organization IS NULL THEN
    RETURN false;
  END IF;

  -- Onko seura piirin listalla?
  SELECT EXISTS(
    SELECT 1 FROM public.lahti_district_clubs WHERE club_name = r.organization
  ) INTO is_district_club;
  IF NOT is_district_club THEN
    RETURN false;
  END IF;

  match_key := public.district_event_match_key(r.event_name);

  -- Etsi vastaava piiriennätys (age_class + event key)
  SELECT * INTO dr FROM public.district_records
  WHERE age_class = r.age_class
    AND public.district_event_match_key(event_name_raw) = match_key
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Onko uusi tulos parempi?
  IF NOT public.is_better_result(r.result_numeric, dr.result_numeric, r.event_category) THEN
    RETURN false;
  END IF;

  -- Kirjaa historia
  INSERT INTO public.district_record_breaks (
    athlete_key, athlete_result_id, age_class, event_pb_key,
    previous_record_id, previous_result_numeric, previous_holder, previous_club, previous_year,
    new_result_numeric, new_holder, new_club,
    competition_id, competition_name, competition_date
  ) VALUES (
    r.athlete_key, r.id, r.age_class, dr.event_pb_key,
    dr.id, dr.result_numeric, dr.record_holder, dr.club, dr.record_year,
    r.result_numeric, trim(r.firstname || ' ' || r.surname), r.organization,
    r.competition_id, r.competition_name, r.competition_date
  );

  -- Päivitä piiriennätys
  UPDATE public.district_records SET
    result_text = r.result_text,
    result_numeric = r.result_numeric,
    record_holder = trim(r.firstname || ' ' || r.surname),
    club = r.organization,
    record_year = EXTRACT(YEAR FROM r.competition_date)::int,
    updated_at = now()
  WHERE id = dr.id;

  -- Merkkaa tulos
  UPDATE public.athlete_results SET was_district_record = true WHERE id = r.id;

  RETURN true;
END;
$$;

-- Trigger: aja tarkistus kun tulos lisätään / result_numeric muuttuu
CREATE OR REPLACE FUNCTION public.trg_check_district_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.check_district_record(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_district_record_trigger ON public.athlete_results;
CREATE TRIGGER check_district_record_trigger
  AFTER INSERT OR UPDATE OF result_numeric ON public.athlete_results
  FOR EACH ROW
  WHEN (NEW.result_numeric IS NOT NULL AND NEW.age_class IS NOT NULL)
  EXECUTE FUNCTION public.trg_check_district_record();

-- Kevyt luku-view etusivulle: tuoreimmat rikkomiset
GRANT SELECT ON public.district_record_breaks TO anon, authenticated;
