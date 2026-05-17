
-- Roles for team members
CREATE TYPE public.team_role AS ENUM ('owner', 'coach', 'member');
CREATE TYPE public.team_invite_status AS ENUM ('pending', 'accepted', 'declined', 'revoked');

-- Teams
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Team members
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.team_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX team_members_user_idx ON public.team_members(user_id);
CREATE INDEX team_members_team_idx ON public.team_members(team_id);

-- Team invites
CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL,
  email text NOT NULL,
  role public.team_role NOT NULL DEFAULT 'member',
  status public.team_invite_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE UNIQUE INDEX team_invites_pending_unique
  ON public.team_invites(team_id, email)
  WHERE status = 'pending';

CREATE INDEX team_invites_email_idx ON public.team_invites(lower(email));

-- updated_at trigger for teams
CREATE TRIGGER teams_set_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.is_team_member(_user uuid, _team uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user AND team_id = _team
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner(_user uuid, _team uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user AND team_id = _team AND role = 'owner'
  );
$$;

-- Returns all user_ids that share at least one team with _user (including _user)
CREATE OR REPLACE FUNCTION public.shared_team_user_ids(_user uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT tm2.user_id
  FROM public.team_members tm1
  JOIN public.team_members tm2 ON tm2.team_id = tm1.team_id
  WHERE tm1.user_id = _user
  UNION
  SELECT _user;
$$;

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- teams policies
CREATE POLICY "Members can view their teams"
  ON public.teams FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid(), id));

CREATE POLICY "Anyone authenticated can create teams"
  ON public.teams FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update their teams"
  ON public.teams FOR UPDATE
  TO authenticated
  USING (public.is_team_owner(auth.uid(), id))
  WITH CHECK (public.is_team_owner(auth.uid(), id));

CREATE POLICY "Owners can delete their teams"
  ON public.teams FOR DELETE
  TO authenticated
  USING (public.is_team_owner(auth.uid(), id));

-- team_members policies
CREATE POLICY "Members can view co-members"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid(), team_id));

CREATE POLICY "Owners can add members"
  ON public.team_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_team_owner(auth.uid(), team_id));

CREATE POLICY "Owners or self can remove member"
  ON public.team_members FOR DELETE
  TO authenticated
  USING (public.is_team_owner(auth.uid(), team_id) OR auth.uid() = user_id);

-- team_invites policies
CREATE POLICY "Inviter or recipient can view invite"
  ON public.team_invites FOR SELECT
  TO authenticated
  USING (
    auth.uid() = invited_by
    OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

CREATE POLICY "Owners can create invites"
  ON public.team_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = invited_by
    AND public.is_team_owner(auth.uid(), team_id)
  );

CREATE POLICY "Recipient or inviter can update invite"
  ON public.team_invites FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = invited_by
    OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
  WITH CHECK (
    auth.uid() = invited_by
    OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

-- Update athlete_notes SELECT policy to include teammates' notes
DROP POLICY IF EXISTS "Users view own notes" ON public.athlete_notes;

CREATE POLICY "Users view own and teammates notes"
  ON public.athlete_notes FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT public.shared_team_user_ids(auth.uid())));
