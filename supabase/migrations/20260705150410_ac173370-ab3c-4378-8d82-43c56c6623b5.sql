
CREATE OR REPLACE FUNCTION public.list_auth_users_with_activity()
RETURNS TABLE(user_id uuid, email text, last_sign_in_at timestamp with time zone, last_seen_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT u.id, u.email::text, u.last_sign_in_at,
    (SELECT max(ae.created_at) FROM public.analytics_events ae WHERE ae.user_id = u.id) AS last_seen_at
  FROM auth.users u
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY (SELECT max(ae.created_at) FROM public.analytics_events ae WHERE ae.user_id = u.id) DESC NULLS LAST,
           u.last_sign_in_at DESC NULLS LAST,
           u.email
$function$;
