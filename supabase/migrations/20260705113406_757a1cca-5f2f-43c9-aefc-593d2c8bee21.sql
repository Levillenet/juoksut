
CREATE OR REPLACE FUNCTION public.district_age_class_equivalent(_ac text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  -- M15 <-> P15, N15 <-> T15
  SELECT CASE
    WHEN _ac ~ '^M[0-9]+$' THEN 'P' || substring(_ac from 2)
    WHEN _ac ~ '^N[0-9]+$' THEN 'T' || substring(_ac from 2)
    WHEN _ac ~ '^P[0-9]+$' THEN 'M' || substring(_ac from 2)
    WHEN _ac ~ '^T[0-9]+$' THEN 'N' || substring(_ac from 2)
    ELSE _ac
  END
$$;

CREATE OR REPLACE FUNCTION public.check_district_record(_result_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.athlete_results;
  dr public.district_records;
  match_key text;
  is_district_club boolean;
  ac_alt text;
BEGIN
  SELECT * INTO r FROM public.athlete_results WHERE id = _result_id;
  IF NOT FOUND OR r.result_numeric IS NULL OR r.age_class IS NULL OR r.organization IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.lahti_district_clubs WHERE club_name = r.organization) INTO is_district_club;
  IF NOT is_district_club THEN RETURN false; END IF;

  match_key := public.district_event_match_key(r.event_name);
  ac_alt := public.district_age_class_equivalent(r.age_class);

  SELECT * INTO dr FROM public.district_records
  WHERE age_class IN (r.age_class, ac_alt)
    AND public.district_event_match_key(event_name_raw) = match_key
  LIMIT 1;

  IF NOT FOUND THEN RETURN false; END IF;

  IF NOT public.is_better_result(r.result_numeric, dr.result_numeric, r.event_category) THEN
    RETURN false;
  END IF;

  INSERT INTO public.district_record_breaks (
    athlete_key, athlete_result_id, age_class, event_pb_key,
    previous_record_id, previous_result_numeric, previous_holder, previous_club, previous_year,
    new_result_numeric, new_holder, new_club,
    competition_id, competition_name, competition_date
  ) VALUES (
    r.athlete_key, r.id, dr.age_class, dr.event_pb_key,
    dr.id, dr.result_numeric, dr.record_holder, dr.club, dr.record_year,
    r.result_numeric, trim(r.firstname || ' ' || r.surname), r.organization,
    r.competition_id, r.competition_name, r.competition_date
  );

  UPDATE public.district_records SET
    result_text = r.result_text,
    result_numeric = r.result_numeric,
    record_holder = trim(r.firstname || ' ' || r.surname),
    club = r.organization,
    record_year = EXTRACT(YEAR FROM r.competition_date)::int,
    updated_at = now()
  WHERE id = dr.id;

  UPDATE public.athlete_results SET was_district_record = true WHERE id = r.id;

  RETURN true;
END;
$$;
