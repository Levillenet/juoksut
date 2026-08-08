-- official_profiles
DROP POLICY IF EXISTS "organizers manage profiles" ON public.official_profiles;
DROP POLICY IF EXISTS "organizers read profiles" ON public.official_profiles;
CREATE POLICY "organizers manage profiles" ON public.official_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'));

-- official_children
DROP POLICY IF EXISTS "organizers read children" ON public.official_children;
CREATE POLICY "organizers read children" ON public.official_children FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'));

-- official_assignments
DROP POLICY IF EXISTS "organizers manage assignments" ON public.official_assignments;
CREATE POLICY "organizers manage assignments" ON public.official_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'));

-- official_competition_calls
DROP POLICY IF EXISTS "organizers manage calls" ON public.official_competition_calls;
CREATE POLICY "organizers manage calls" ON public.official_competition_calls FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'));

-- volunteer_calls
DROP POLICY IF EXISTS "Jarjestajat hallinnoivat talkoohakuja" ON public.volunteer_calls;
CREATE POLICY "Jarjestajat hallinnoivat talkoohakuja" ON public.volunteer_calls FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'));

-- volunteer_tasks
DROP POLICY IF EXISTS "Jarjestajat hallinnoivat talkootehtavia" ON public.volunteer_tasks;
CREATE POLICY "Jarjestajat hallinnoivat talkootehtavia" ON public.volunteer_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'));

-- volunteer_signups
DROP POLICY IF EXISTS "Jarjestajat hallinnoivat ilmoittautumisia" ON public.volunteer_signups;
CREATE POLICY "Jarjestajat hallinnoivat ilmoittautumisia" ON public.volunteer_signups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'));

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'organizer'::public.app_role FROM auth.users u
WHERE lower(u.email) = 'samiaavikko@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;