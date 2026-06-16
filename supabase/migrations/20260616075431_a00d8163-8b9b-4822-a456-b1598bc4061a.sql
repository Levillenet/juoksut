CREATE OR REPLACE FUNCTION public.list_auth_users()
RETURNS TABLE(user_id uuid, email text, last_sign_in_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.email::text, u.last_sign_in_at
  FROM auth.users u
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY u.last_sign_in_at DESC NULLS LAST, u.email
$$;
GRANT EXECUTE ON FUNCTION public.list_auth_users() TO authenticated;