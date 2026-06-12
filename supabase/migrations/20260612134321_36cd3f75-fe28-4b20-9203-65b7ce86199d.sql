CREATE OR REPLACE FUNCTION public.get_shared_watch_history(p_token text, p_exclude_competition_id integer)
RETURNS TABLE(
  athlete_key text,
  event_name text,
  event_category text,
  sub_category text,
  result_text text,
  result_numeric double precision
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ar.athlete_key,
    ar.event_name,
    ar.event_category,
    ar.sub_category,
    ar.result_text,
    ar.result_numeric
  FROM public.watch_shares s
  JOIN public.watched_athletes wa ON wa.user_id = s.user_id
  JOIN public.athlete_results ar ON ar.athlete_key = wa.athlete_key
  WHERE s.token = p_token
    AND s.revoked_at IS NULL
    AND ar.competition_id <> p_exclude_competition_id
    AND ar.result_numeric IS NOT NULL
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_watch_history(text, integer) TO anon, authenticated;