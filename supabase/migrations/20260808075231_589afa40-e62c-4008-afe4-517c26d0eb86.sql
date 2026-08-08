-- Talkoohaut
CREATE TABLE public.volunteer_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id integer NOT NULL UNIQUE,
  competition_name text NOT NULL,
  competition_date timestamptz,
  share_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  open_from date,
  open_until date,
  message text,
  opened_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.volunteer_calls TO authenticated;
GRANT ALL ON public.volunteer_calls TO service_role;
ALTER TABLE public.volunteer_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kirjautuneet lukevat talkoohaut" ON public.volunteer_calls
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Jarjestajat hallinnoivat talkoohakuja" ON public.volunteer_calls
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'official') OR public.has_role(auth.uid(), 'planner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'official') OR public.has_role(auth.uid(), 'planner'));

CREATE TRIGGER volunteer_calls_updated_at BEFORE UPDATE ON public.volunteer_calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Talkootehtävät
CREATE TABLE public.volunteer_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id integer NOT NULL,
  name text NOT NULL,
  description text,
  day date,
  start_time time,
  end_time time,
  location text,
  needed_count integer NOT NULL DEFAULT 1,
  contact_name text,
  contact_phone text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX volunteer_tasks_competition_idx ON public.volunteer_tasks (competition_id, day, start_time);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.volunteer_tasks TO authenticated;
GRANT ALL ON public.volunteer_tasks TO service_role;
ALTER TABLE public.volunteer_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kirjautuneet lukevat talkootehtavat" ON public.volunteer_tasks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Jarjestajat hallinnoivat talkootehtavia" ON public.volunteer_tasks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'official') OR public.has_role(auth.uid(), 'planner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'official') OR public.has_role(auth.uid(), 'planner'));

CREATE TRIGGER volunteer_tasks_updated_at BEFORE UPDATE ON public.volunteer_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ilmoittautumiset
CREATE TABLE public.volunteer_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.volunteer_tasks(id) ON DELETE CASCADE,
  competition_id integer NOT NULL,
  user_id uuid,
  full_name text NOT NULL,
  phone text,
  email text,
  note text,
  status text NOT NULL DEFAULT 'signed',
  source text NOT NULL DEFAULT 'self',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX volunteer_signups_task_idx ON public.volunteer_signups (task_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.volunteer_signups TO authenticated;
GRANT ALL ON public.volunteer_signups TO service_role;
ALTER TABLE public.volunteer_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jarjestajat hallinnoivat ilmoittautumisia" ON public.volunteer_signups
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'official') OR public.has_role(auth.uid(), 'planner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'official') OR public.has_role(auth.uid(), 'planner'));
CREATE POLICY "Omat ilmoittautumiset nakyvat" ON public.volunteer_signups
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Omat ilmoittautumiset lisataan" ON public.volunteer_signups
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Omat ilmoittautumiset paivitetaan" ON public.volunteer_signups
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Omat ilmoittautumiset poistetaan" ON public.volunteer_signups
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER volunteer_signups_updated_at BEFORE UPDATE ON public.volunteer_signups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Julkiset tokenpohjaiset funktiot
CREATE OR REPLACE FUNCTION public.get_volunteer_call(_token text)
RETURNS TABLE(competition_id integer, competition_name text, competition_date timestamptz, open_from date, open_until date, message text, is_open boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.competition_id, c.competition_name, c.competition_date, c.open_from, c.open_until, c.message,
    (coalesce(c.open_from, '-infinity'::date) <= (now() AT TIME ZONE 'Europe/Helsinki')::date
     AND coalesce(c.open_until, 'infinity'::date) >= (now() AT TIME ZONE 'Europe/Helsinki')::date) AS is_open
  FROM public.volunteer_calls c
  WHERE c.share_token = _token
$$;

CREATE OR REPLACE FUNCTION public.list_volunteer_tasks(_token text)
RETURNS TABLE(id uuid, name text, description text, day date, start_time time, end_time time, location text, needed_count integer, contact_name text, contact_phone text, sort_order integer, signed_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.name, t.description, t.day, t.start_time, t.end_time, t.location, t.needed_count,
         t.contact_name, t.contact_phone, t.sort_order,
         (SELECT count(*) FROM public.volunteer_signups s WHERE s.task_id = t.id AND s.status = 'signed') AS signed_count
  FROM public.volunteer_tasks t
  JOIN public.volunteer_calls c ON c.competition_id = t.competition_id
  WHERE c.share_token = _token
  ORDER BY t.day NULLS LAST, t.start_time NULLS LAST, t.sort_order, t.name
$$;

CREATE OR REPLACE FUNCTION public.volunteer_signup(_token text, _task_id uuid, _name text, _phone text DEFAULT NULL, _email text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_comp integer;
  v_open boolean;
  v_id uuid;
BEGIN
  IF coalesce(trim(_name), '') = '' THEN
    RAISE EXCEPTION 'Nimi puuttuu';
  END IF;

  SELECT c.competition_id,
    (coalesce(c.open_from, '-infinity'::date) <= (now() AT TIME ZONE 'Europe/Helsinki')::date
     AND coalesce(c.open_until, 'infinity'::date) >= (now() AT TIME ZONE 'Europe/Helsinki')::date)
  INTO v_comp, v_open
  FROM public.volunteer_calls c
  JOIN public.volunteer_tasks t ON t.competition_id = c.competition_id
  WHERE c.share_token = _token AND t.id = _task_id;

  IF v_comp IS NULL THEN
    RAISE EXCEPTION 'Talkoohakua ei löydy';
  END IF;
  IF NOT v_open THEN
    RAISE EXCEPTION 'Talkoohaku ei ole auki';
  END IF;

  INSERT INTO public.volunteer_signups (task_id, competition_id, user_id, full_name, phone, email, note, status, source)
  VALUES (_task_id, v_comp, auth.uid(), trim(_name), nullif(trim(coalesce(_phone,'')),''), nullif(trim(coalesce(_email,'')),''), nullif(trim(coalesce(_note,'')),''), 'signed', 'self')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.volunteer_cancel_signup(_token text, _signup_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE public.volunteer_signups s
  SET status = 'cancelled'
  FROM public.volunteer_calls c
  WHERE s.id = _signup_id
    AND c.competition_id = s.competition_id
    AND c.share_token = _token
    AND s.user_id IS NOT NULL
    AND s.user_id = auth.uid();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_volunteer_call(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_volunteer_tasks(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.volunteer_signup(text, uuid, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.volunteer_cancel_signup(text, uuid) TO authenticated;