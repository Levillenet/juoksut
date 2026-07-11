
CREATE TABLE public.origin_call_daily (
  day date NOT NULL,
  source text NOT NULL,
  path_kind text NOT NULL,
  status_bucket text NOT NULL,
  count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, source, path_kind, status_bucket)
);

GRANT SELECT ON public.origin_call_daily TO authenticated;
GRANT ALL ON public.origin_call_daily TO service_role;

ALTER TABLE public.origin_call_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view origin call stats"
  ON public.origin_call_daily
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.bump_origin_call(
  _source text,
  _path_kind text,
  _status_bucket text,
  _delta bigint DEFAULT 1
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.origin_call_daily (day, source, path_kind, status_bucket, count, updated_at)
  VALUES ((now() AT TIME ZONE 'Europe/Helsinki')::date, _source, _path_kind, _status_bucket, _delta, now())
  ON CONFLICT (day, source, path_kind, status_bucket)
  DO UPDATE SET count = public.origin_call_daily.count + EXCLUDED.count,
                updated_at = now();
END;
$$;
