
-- Admin email check helper
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce((auth.jwt() ->> 'email'), '')) = 'samiaavikko@gmail.com';
$$;

CREATE TABLE public.analytics_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name text NOT NULL,
  path text NOT NULL DEFAULT '',
  user_id uuid,
  user_email text,
  role text,
  metadata jsonb,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_events_created_at ON public.analytics_events (created_at DESC);
CREATE INDEX idx_analytics_events_event_name ON public.analytics_events (event_name);
CREATE INDEX idx_analytics_events_path ON public.analytics_events (path);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anonymous visitors) may insert events
CREATE POLICY "Anyone can insert analytics events"
ON public.analytics_events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admin email may read
CREATE POLICY "Only admin can read analytics events"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (public.is_admin_user());
