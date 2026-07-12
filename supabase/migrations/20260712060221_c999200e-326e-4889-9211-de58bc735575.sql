CREATE OR REPLACE FUNCTION public.normalize_event_name(name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(coalesce(name, ''),
              '^(?:[MNTmnt][0-9]*|[Pp][0-9]+)\s+', ''),
            '^[0-9]+-ottelu\s+', '', 'i'),
          '\s*-\s*R\d.*$', '', 'i'),
        '\s*\([^)]*\)\s*$', '', 'g'),
      '\s+(?:kilpailu|kierros|erä)\s*\d+\s*$', '', 'i'),
    '\s+', ' ', 'g'))
$function$;