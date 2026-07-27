CREATE TABLE IF NOT EXISTS public.origin_call_path_daily (
  day date NOT NULL,
  source text NOT NULL,
  path_kind text NOT NULL,
  path text NOT NULL,
  status_bucket text NOT NULL,
  count bigint NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (day, source, path_kind, path, status_bucket)
);

GRANT SELECT ON public.origin_call_path_daily TO authenticated;
GRANT ALL ON public.origin_call_path_daily TO service_role;

ALTER TABLE public.origin_call_path_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view origin call path stats" ON public.origin_call_path_daily;
CREATE POLICY "Admins can view origin call path stats"
  ON public.origin_call_path_daily
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS origin_call_path_daily_day_count_idx
  ON public.origin_call_path_daily (day DESC, count DESC);

CREATE INDEX IF NOT EXISTS origin_call_path_daily_path_kind_idx
  ON public.origin_call_path_daily (path_kind, day DESC);

CREATE OR REPLACE FUNCTION public.bump_origin_call_path(
  _source text,
  _path text,
  _path_kind text,
  _status_bucket text,
  _delta bigint DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'Europe/Helsinki')::date;
BEGIN
  PERFORM public.bump_origin_call(_source, _path_kind, _status_bucket, _delta);

  INSERT INTO public.origin_call_path_daily (day, source, path_kind, path, status_bucket, count, updated_at)
  VALUES (v_day, _source, _path_kind, _path, _status_bucket, _delta, now())
  ON CONFLICT (day, source, path_kind, path, status_bucket)
  DO UPDATE SET count = public.origin_call_path_daily.count + EXCLUDED.count,
                updated_at = now();
END;
$$;