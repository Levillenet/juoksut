
-- 1) Roolit
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'planner');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Politiikat user_roles-taululle
DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
CREATE POLICY "Users can read their own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
CREATE POLICY "Admins can read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Apufunktiot rooleilla työskentelyyn
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.list_role_members()
RETURNS TABLE(user_id uuid, email text, role public.app_role, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id, u.email::text, ur.role, ur.created_at
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY ur.role, u.email
$$;

CREATE OR REPLACE FUNCTION public.grant_role_by_email(_email text, _role public.app_role)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Vain admin voi myöntää rooleja';
  END IF;
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Käyttäjää ei löydy sähköpostilla %', _email;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_role(_user_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Vain admin voi poistaa rooleja';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
END;
$$;

-- 3) Seedaa admin samiaavikko@gmail.com:lle (jos käyttäjä on olemassa)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'samiaavikko@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 4) Stadionit jaetuiksi planner/admin-rooleille
DROP POLICY IF EXISTS "Owner manages own stadiums" ON public.stadiums;
CREATE POLICY "Planners manage stadiums" ON public.stadiums
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'planner') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'planner') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owner manages own stadium venues" ON public.stadium_venues;
CREATE POLICY "Planners manage stadium venues" ON public.stadium_venues
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'planner') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'planner') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owner manages own stadium conflict groups" ON public.stadium_conflict_groups;
DROP POLICY IF EXISTS "Owner manages own conflict groups" ON public.stadium_conflict_groups;
CREATE POLICY "Planners manage stadium conflict groups" ON public.stadium_conflict_groups
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'planner') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'planner') OR public.has_role(auth.uid(), 'admin'));

-- Sallitaan user_id NULL stadiumeissa (kun useampi muokkaa)
ALTER TABLE public.stadiums ALTER COLUMN user_id DROP NOT NULL;
