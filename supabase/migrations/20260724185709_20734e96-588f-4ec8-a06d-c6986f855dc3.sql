-- Välimuistilukkojen taulu, jolla estetään usean Worker-isolaatin
-- rinnakkaiset origin-kutsut samalle tulokselle.
CREATE TABLE IF NOT EXISTS public.tuloslista_proxy_fetch_locks (
  path text PRIMARY KEY,
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

GRANT ALL ON public.tuloslista_proxy_fetch_locks TO service_role;

ALTER TABLE public.tuloslista_proxy_fetch_locks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tuloslista_proxy_fetch_locks'
      AND policyname = 'service_role only'
  ) THEN
    CREATE POLICY "service_role only"
    ON public.tuloslista_proxy_fetch_locks
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_tuloslista_proxy_fetch_locks_expires_at
  ON public.tuloslista_proxy_fetch_locks (expires_at);

-- Yrittää ottaa lukon polulle. Palauttaa true, jos kutsuja sai lukon.
-- Vanhentuneet lukot (expires_at < now) vapautuvat automaattisesti.
CREATE OR REPLACE FUNCTION public.try_tuloslista_proxy_lock(_path text, _ttl_seconds integer DEFAULT 10)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  got_it boolean := false;
BEGIN
  -- Puhdista vanhentuneet lukot
  DELETE FROM public.tuloslista_proxy_fetch_locks
  WHERE path = _path AND expires_at < now();

  -- Yritä lisätä uusi lukko
  INSERT INTO public.tuloslista_proxy_fetch_locks(path, locked_at, expires_at)
  VALUES (_path, now(), now() + (_ttl_seconds || ' seconds')::interval)
  ON CONFLICT (path) DO NOTHING;

  IF FOUND THEN
    got_it := true;
  END IF;

  RETURN got_it;
END;
$$;

-- Vapauttaa lukon ja kirjoittaa vastauksen välimuistiin samalla transaktiolla.
CREATE OR REPLACE FUNCTION public.release_tuloslista_proxy_lock(_path text, _body text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.tuloslista_proxy_fetch_locks WHERE path = _path;
  PERFORM public.set_tuloslista_proxy_cache(_path, _body);
END;
$$;

-- Vapauttaa lukon ilman välimuistin päivitystä (virhe- tai timeout-tilanne).
CREATE OR REPLACE FUNCTION public.release_tuloslista_proxy_lock_empty(_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.tuloslista_proxy_fetch_locks WHERE path = _path;
END;
$$;

-- Siivoa vanhat lukot, joita ei ole vapautettu.
CREATE OR REPLACE FUNCTION public.prune_tuloslista_proxy_fetch_locks()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.tuloslista_proxy_fetch_locks
  WHERE expires_at < now() - interval '1 minute'
$$;

-- Lisätään cache-taululle updated_at-indeksi nopeampaan pruningiin.
CREATE INDEX IF NOT EXISTS idx_tuloslista_proxy_cache_updated_at
  ON public.tuloslista_proxy_cache (updated_at);
