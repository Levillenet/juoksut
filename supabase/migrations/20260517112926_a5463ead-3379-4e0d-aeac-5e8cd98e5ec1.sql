CREATE OR REPLACE FUNCTION public.normalize_event_name(name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(regexp_replace(
    regexp_replace(coalesce(name, ''), '^(?:[MNTmnt][0-9]*|[Pp][0-9]+)\s+', ''),
    '^[0-9]+-ottelu\s+', '', 'i'
  ))
$$;