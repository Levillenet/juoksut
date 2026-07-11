CREATE TABLE IF NOT EXISTS public.tuloslista_proxy_cache (
  path text PRIMARY KEY,
  body text NOT NULL,
  cached_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.tuloslista_proxy_cache TO service_role;

ALTER TABLE public.tuloslista_proxy_cache ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tuloslista_proxy_cache_cached_at
  ON public.tuloslista_proxy_cache (cached_at);

CREATE OR REPLACE FUNCTION public.get_tuloslista_proxy_cache(_path text)
RETURNS TABLE(body text, cached_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.body, c.cached_at
  FROM public.tuloslista_proxy_cache c
  WHERE c.path = _path
$$;

CREATE OR REPLACE FUNCTION public.set_tuloslista_proxy_cache(_path text, _body text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.tuloslista_proxy_cache(path, body, cached_at, updated_at)
  VALUES (_path, _body, now(), now())
  ON CONFLICT (path) DO UPDATE SET
    body = excluded.body,
    cached_at = excluded.cached_at,
    updated_at = excluded.updated_at
$$;

CREATE OR REPLACE FUNCTION public.prune_tuloslista_proxy_cache()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.tuloslista_proxy_cache
  WHERE cached_at < now() - interval '6 hours'
$$;