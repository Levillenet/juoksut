
CREATE TABLE public.welcome_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.welcome_messages TO authenticated;
GRANT INSERT, UPDATE ON public.welcome_messages TO authenticated;
GRANT ALL ON public.welcome_messages TO service_role;

ALTER TABLE public.welcome_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read welcome message"
  ON public.welcome_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert welcome message"
  ON public.welcome_messages FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update welcome message"
  ON public.welcome_messages FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER welcome_messages_touch_updated_at
  BEFORE UPDATE ON public.welcome_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.welcome_messages (singleton, title, body, enabled)
VALUES (true, '', '', false);
