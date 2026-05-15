
-- Table for shareable watch links
CREATE TABLE public.watch_shares (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competition_id integer NOT NULL,
  owner_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE UNIQUE INDEX idx_watch_shares_user_competition
  ON public.watch_shares(user_id, competition_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.watch_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view own shares" ON public.watch_shares
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert own shares" ON public.watch_shares
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update own shares" ON public.watch_shares
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Owner can delete own shares" ON public.watch_shares
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Public read via security definer function (token = capability)
CREATE OR REPLACE FUNCTION public.get_shared_watch(p_token text)
RETURNS TABLE (
  competition_id integer,
  owner_label text,
  revoked boolean,
  athlete_key text,
  surname text,
  firstname text,
  organization text,
  organization_id integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.competition_id,
    s.owner_label,
    (s.revoked_at IS NOT NULL) AS revoked,
    wa.athlete_key,
    wa.surname,
    wa.firstname,
    wa.organization,
    wa.organization_id
  FROM public.watch_shares s
  LEFT JOIN public.watched_athletes wa
    ON wa.user_id = s.user_id AND s.revoked_at IS NULL
  WHERE s.token = p_token
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_watch(text) TO anon, authenticated;
