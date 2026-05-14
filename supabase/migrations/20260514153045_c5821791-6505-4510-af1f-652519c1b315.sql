CREATE OR REPLACE FUNCTION public.harvest_try_lock()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_try_advisory_lock(hashtext('harvest-tuloslista')::bigint);
$$;

CREATE OR REPLACE FUNCTION public.harvest_unlock()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_advisory_unlock(hashtext('harvest-tuloslista')::bigint);
$$;

REVOKE ALL ON FUNCTION public.harvest_try_lock() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.harvest_unlock() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.harvest_try_lock() TO service_role;
GRANT EXECUTE ON FUNCTION public.harvest_unlock() TO service_role;