-- 1. official_profiles: manual cards without a user account
ALTER TABLE public.official_profiles ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.official_profiles DROP CONSTRAINT IF EXISTS official_profiles_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS official_profiles_user_id_uidx
  ON public.official_profiles(user_id) WHERE user_id IS NOT NULL;
ALTER TABLE public.official_profiles ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.official_profiles ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

DROP POLICY IF EXISTS "organizers manage profiles" ON public.official_profiles;
CREATE POLICY "organizers manage profiles" ON public.official_profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'official'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'official'));

-- 2. calls: shareable link + open_from + day windows
ALTER TABLE public.official_competition_calls
  ADD COLUMN IF NOT EXISTS share_token text,
  ADD COLUMN IF NOT EXISTS open_from date,
  ADD COLUMN IF NOT EXISTS days jsonb;
UPDATE public.official_competition_calls
  SET share_token = encode(gen_random_bytes(9),'hex') WHERE share_token IS NULL;
ALTER TABLE public.official_competition_calls
  ALTER COLUMN share_token SET DEFAULT encode(gen_random_bytes(9),'hex');
CREATE UNIQUE INDEX IF NOT EXISTS official_calls_share_token_uidx
  ON public.official_competition_calls(share_token);

-- 3. per-day availability
CREATE TABLE IF NOT EXISTS public.official_day_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.official_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  competition_id integer NOT NULL,
  day date NOT NULL,
  available boolean NOT NULL DEFAULT true,
  start_time time,
  end_time time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, competition_id, day)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.official_day_availability TO authenticated;
GRANT ALL ON public.official_day_availability TO service_role;
ALTER TABLE public.official_day_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own day availability" ON public.official_day_availability
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "organizers manage day availability" ON public.official_day_availability
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'official'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'official'));
CREATE TRIGGER official_day_availability_updated_at BEFORE UPDATE ON public.official_day_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. minimum officials per event
CREATE TABLE IF NOT EXISTS public.official_event_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id integer NOT NULL,
  round_id integer NOT NULL,
  event_id integer,
  event_name text NOT NULL DEFAULT '',
  age_class text,
  starts_at timestamptz,
  min_officials integer NOT NULL DEFAULT 2,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, round_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.official_event_requirements TO authenticated;
GRANT ALL ON public.official_event_requirements TO service_role;
ALTER TABLE public.official_event_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read requirements" ON public.official_event_requirements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "organizers manage requirements" ON public.official_event_requirements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'official'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'official'));
CREATE TRIGGER official_event_requirements_updated_at BEFORE UPDATE ON public.official_event_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. assignments: self signup support
ALTER TABLE public.official_assignments
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'organizer',
  ADD COLUMN IF NOT EXISTS day date;

CREATE POLICY "own assignments manage" ON public.official_assignments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.official_profiles p
                 WHERE p.id = official_assignments.profile_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.official_profiles p
                 WHERE p.id = official_assignments.profile_id AND p.user_id = auth.uid()));