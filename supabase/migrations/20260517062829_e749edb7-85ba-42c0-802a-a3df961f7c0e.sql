-- note_links: aktiiviset kaksisuuntaiset linkit
CREATE TABLE public.note_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id uuid NOT NULL,
  user_b_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT note_links_order_chk CHECK (user_a_id < user_b_id),
  CONSTRAINT note_links_unique UNIQUE (user_a_id, user_b_id)
);

ALTER TABLE public.note_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Linked users can view their links"
ON public.note_links FOR SELECT TO authenticated
USING (auth.uid() IN (user_a_id, user_b_id));

CREATE POLICY "Linked users can delete their links"
ON public.note_links FOR DELETE TO authenticated
USING (auth.uid() IN (user_a_id, user_b_id));

-- note_link_invites
CREATE TYPE public.note_link_invite_status AS ENUM ('pending','accepted','declined','revoked');

CREATE TABLE public.note_link_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id uuid NOT NULL,
  email text NOT NULL,
  status public.note_link_invite_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE UNIQUE INDEX note_link_invites_unique_pending
  ON public.note_link_invites (inviter_user_id, email)
  WHERE status = 'pending';

ALTER TABLE public.note_link_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inviter or recipient can view invite"
ON public.note_link_invites FOR SELECT TO authenticated
USING (
  auth.uid() = inviter_user_id
  OR lower(email) = lower(COALESCE((auth.jwt() ->> 'email'), ''))
);

CREATE POLICY "Inviter can create invite"
ON public.note_link_invites FOR INSERT TO authenticated
WITH CHECK (auth.uid() = inviter_user_id);

CREATE POLICY "Inviter or recipient can update invite"
ON public.note_link_invites FOR UPDATE TO authenticated
USING (
  auth.uid() = inviter_user_id
  OR lower(email) = lower(COALESCE((auth.jwt() ->> 'email'), ''))
)
WITH CHECK (
  auth.uid() = inviter_user_id
  OR lower(email) = lower(COALESCE((auth.jwt() ->> 'email'), ''))
);

-- Yhdistetty omistajalista: itse + tiimiläiset + suoraan linkitetyt
CREATE OR REPLACE FUNCTION public.shared_note_owner_ids(_user uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user
  UNION
  SELECT user_id FROM public.shared_team_user_ids(_user) AS user_id
  UNION
  SELECT CASE WHEN user_a_id = _user THEN user_b_id ELSE user_a_id END
  FROM public.note_links
  WHERE _user IN (user_a_id, user_b_id);
$$;

-- Päivitä athlete_notes SELECT-policy
DROP POLICY IF EXISTS "Users view own and teammates notes" ON public.athlete_notes;

CREATE POLICY "Users view own and shared notes"
ON public.athlete_notes FOR SELECT TO authenticated
USING (user_id IN (SELECT public.shared_note_owner_ids(auth.uid())));
