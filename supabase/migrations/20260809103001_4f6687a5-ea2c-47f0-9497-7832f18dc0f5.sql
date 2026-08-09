CREATE TABLE IF NOT EXISTS public.harvest_locks (
  name text PRIMARY KEY,
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

GRANT ALL ON public.harvest_locks TO service_role;
ALTER TABLE public.harvest_locks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.harvest_try_lock(_name text DEFAULT 'full', _ttl_seconds integer DEFAULT 180)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  got boolean := false;
BEGIN
  DELETE FROM public.harvest_locks WHERE expires_at < now();

  INSERT INTO public.harvest_locks(name, locked_at, expires_at)
  VALUES (_name, now(), now() + make_interval(secs => _ttl_seconds))
  ON CONFLICT (name) DO NOTHING;

  GET DIAGNOSTICS got = ROW_COUNT;
  RETURN got;
END;
$$;

CREATE OR REPLACE FUNCTION public.harvest_unlock(_name text DEFAULT 'full')
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.harvest_locks WHERE name = _name;
$$;