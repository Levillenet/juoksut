-- 1) Profiilit
CREATE TABLE public.official_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  club text,
  skills text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.official_profiles TO authenticated;
GRANT ALL ON public.official_profiles TO service_role;
ALTER TABLE public.official_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile all" ON public.official_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "organizers read profiles" ON public.official_profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'official'));
CREATE TRIGGER official_profiles_updated_at BEFORE UPDATE ON public.official_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Kiinnitetyt urheilijat
CREATE TABLE public.official_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.official_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  athlete_key text NOT NULL,
  surname text NOT NULL,
  firstname text NOT NULL,
  organization text,
  organization_id integer,
  is_guardian boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, athlete_key)
);
CREATE INDEX official_children_athlete_key_idx ON public.official_children(athlete_key);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.official_children TO authenticated;
GRANT ALL ON public.official_children TO service_role;
ALTER TABLE public.official_children ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own children all" ON public.official_children FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "organizers read children" ON public.official_children FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'official'));
CREATE TRIGGER official_children_updated_at BEFORE UPDATE ON public.official_children
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Toimitsijahaut kilpailuihin
CREATE TABLE public.official_competition_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id integer NOT NULL UNIQUE,
  competition_name text NOT NULL,
  competition_date timestamptz,
  opened_by uuid,
  open_until date,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.official_competition_calls TO authenticated;
GRANT ALL ON public.official_competition_calls TO service_role;
ALTER TABLE public.official_competition_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read calls" ON public.official_competition_calls FOR SELECT TO authenticated USING (true);
CREATE POLICY "organizers manage calls" ON public.official_competition_calls FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'official'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'official'));
CREATE TRIGGER official_calls_updated_at BEFORE UPDATE ON public.official_competition_calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Käytettävyysilmoitukset
CREATE TABLE public.official_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  competition_id integer NOT NULL,
  available boolean NOT NULL DEFAULT true,
  constraint_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, competition_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.official_availability TO authenticated;
GRANT ALL ON public.official_availability TO service_role;
ALTER TABLE public.official_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own availability all" ON public.official_availability FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "organizers read availability" ON public.official_availability FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'official'));
CREATE TRIGGER official_availability_updated_at BEFORE UPDATE ON public.official_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Lajikohtaiset kiinnitykset
CREATE TABLE public.official_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id integer NOT NULL,
  event_id integer,
  round_id integer,
  event_name text NOT NULL,
  age_class text,
  starts_at timestamptz,
  profile_id uuid NOT NULL REFERENCES public.official_profiles(id) ON DELETE CASCADE,
  role_label text,
  status text NOT NULL DEFAULT 'proposed',
  confirm_token text UNIQUE,
  requested_at timestamptz,
  responded_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, round_id, profile_id)
);
CREATE INDEX official_assignments_comp_idx ON public.official_assignments(competition_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.official_assignments TO authenticated;
GRANT ALL ON public.official_assignments TO service_role;
ALTER TABLE public.official_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read assignments" ON public.official_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "organizers manage assignments" ON public.official_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'official'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'official'));
CREATE TRIGGER official_assignments_updated_at BEFORE UPDATE ON public.official_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();