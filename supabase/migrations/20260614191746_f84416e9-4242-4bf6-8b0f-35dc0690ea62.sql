
CREATE TABLE public.stadiums (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stadiums TO authenticated;
GRANT ALL ON public.stadiums TO service_role;
ALTER TABLE public.stadiums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own stadiums" ON public.stadiums
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER stadiums_updated BEFORE UPDATE ON public.stadiums
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.stadium_venues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stadium_id uuid NOT NULL REFERENCES public.stadiums(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stadium_venues_stadium_idx ON public.stadium_venues(stadium_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stadium_venues TO authenticated;
GRANT ALL ON public.stadium_venues TO service_role;
ALTER TABLE public.stadium_venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own stadium venues" ON public.stadium_venues
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.stadiums s WHERE s.id = stadium_id AND s.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.stadiums s WHERE s.id = stadium_id AND s.user_id = auth.uid())
  );
CREATE TRIGGER stadium_venues_updated BEFORE UPDATE ON public.stadium_venues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.stadium_conflict_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stadium_id uuid NOT NULL REFERENCES public.stadiums(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  venue_ids uuid[] NOT NULL DEFAULT '{}',
  max_concurrent integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stadium_conflict_groups_stadium_idx ON public.stadium_conflict_groups(stadium_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stadium_conflict_groups TO authenticated;
GRANT ALL ON public.stadium_conflict_groups TO service_role;
ALTER TABLE public.stadium_conflict_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own stadium conflicts" ON public.stadium_conflict_groups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.stadiums s WHERE s.id = stadium_id AND s.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.stadiums s WHERE s.id = stadium_id AND s.user_id = auth.uid())
  );
CREATE TRIGGER stadium_conflict_groups_updated BEFORE UPDATE ON public.stadium_conflict_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
