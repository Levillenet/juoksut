
CREATE TABLE public.athlete_shares (
  token text PRIMARY KEY,
  user_id uuid NOT NULL,
  athlete_key text NOT NULL,
  surname text NOT NULL DEFAULT '',
  firstname text NOT NULL DEFAULT '',
  organization text NOT NULL DEFAULT '',
  organization_id integer,
  owner_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE UNIQUE INDEX athlete_shares_user_athlete_active_idx
  ON public.athlete_shares (user_id, athlete_key)
  WHERE revoked_at IS NULL;

ALTER TABLE public.athlete_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view own athlete shares"
  ON public.athlete_shares FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert own athlete shares"
  ON public.athlete_shares FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update own athlete shares"
  ON public.athlete_shares FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can delete own athlete shares"
  ON public.athlete_shares FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_shared_athlete(p_token text)
RETURNS TABLE(
  athlete_key text,
  surname text,
  firstname text,
  organization text,
  organization_id integer,
  owner_label text,
  revoked boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.athlete_key,
    s.surname,
    s.firstname,
    s.organization,
    s.organization_id,
    s.owner_label,
    (s.revoked_at IS NOT NULL) AS revoked
  FROM public.athlete_shares s
  WHERE s.token = p_token
$$;

CREATE OR REPLACE FUNCTION public.get_shared_athlete_results(p_token text)
RETURNS TABLE(
  id uuid,
  athlete_key text,
  surname text,
  firstname text,
  organization text,
  organization_id integer,
  competition_id integer,
  competition_name text,
  competition_date timestamptz,
  location text,
  event_id integer,
  event_name text,
  sub_category text,
  event_category text,
  result_text text,
  result_numeric double precision,
  result_rank integer,
  wind double precision,
  was_pb boolean,
  age_class text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ar.id,
    ar.athlete_key,
    ar.surname,
    ar.firstname,
    ar.organization,
    ar.organization_id,
    ar.competition_id,
    ar.competition_name,
    ar.competition_date,
    ar.location,
    ar.event_id,
    ar.event_name,
    ar.sub_category,
    ar.event_category,
    ar.result_text,
    ar.result_numeric,
    ar.result_rank,
    ar.wind,
    ar.was_pb,
    ar.age_class
  FROM public.athlete_shares s
  JOIN public.athlete_results ar ON ar.athlete_key = s.athlete_key
  WHERE s.token = p_token AND s.revoked_at IS NULL
  ORDER BY ar.competition_date ASC NULLS LAST
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_athlete(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_athlete_results(text) TO anon, authenticated;
