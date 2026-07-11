CREATE OR REPLACE FUNCTION public.harvest_try_lock()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT true;
$function$;

CREATE OR REPLACE FUNCTION public.harvest_unlock()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT NULL::void;
$function$;