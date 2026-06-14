-- 1. competition_plans
CREATE TABLE public.competition_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  default_recovery_min integer NOT NULL DEFAULT 30,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_plans TO authenticated;
GRANT ALL ON public.competition_plans TO service_role;
ALTER TABLE public.competition_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can manage own plans" ON public.competition_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_competition_plans_updated_at
  BEFORE UPDATE ON public.competition_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. plan_venues
CREATE TABLE public.plan_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.competition_plans(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'other',
  -- 'track_straight' (etusuora/takasuora), 'track_oval', 'jump_pit', 'high_jump',
  -- 'pole_vault', 'throw_ring', 'throw_runway', 'other'
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_venues TO authenticated;
GRANT ALL ON public.plan_venues TO service_role;
ALTER TABLE public.plan_venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner via plan can manage venues" ON public.plan_venues
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.competition_plans p
            WHERE p.id = plan_id AND p.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.competition_plans p
            WHERE p.id = plan_id AND p.user_id = auth.uid())
  );
CREATE INDEX idx_plan_venues_plan ON public.plan_venues(plan_id);

-- 3. plan_events
CREATE TABLE public.plan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.competition_plans(id) ON DELETE CASCADE,
  age_class text NOT NULL,
  event_name text NOT NULL,
  -- Onko sub_category (Run / Hurdles / LongJump / HighJump / ShotPut ...)
  sub_category text,
  participants integer NOT NULL DEFAULT 0 CHECK (participants >= 0),
  -- "direct" = kaikki erät, järjestys nopeuden mukaan. "a_b" = erien jälkeen A/B-finaalit.
  final_format text NOT NULL DEFAULT 'direct' CHECK (final_format IN ('direct', 'a_b')),
  -- Esim. 8 = A-finaaliin 8 nopeinta.
  final_cut integer,
  -- Montako rinnakkaista suorituspaikkaa tämä laji käyttää (esim. 2 pituuskuoppaa samalla sarjalla).
  station_count integer NOT NULL DEFAULT 1 CHECK (station_count >= 1),
  -- Käyttäjän manuaalinen kestoarvio minuutteina (ohittaa regression).
  override_duration_min integer,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_events TO authenticated;
GRANT ALL ON public.plan_events TO service_role;
ALTER TABLE public.plan_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner via plan can manage events" ON public.plan_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.competition_plans p
            WHERE p.id = plan_id AND p.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.competition_plans p
            WHERE p.id = plan_id AND p.user_id = auth.uid())
  );
CREATE INDEX idx_plan_events_plan ON public.plan_events(plan_id);

CREATE TRIGGER trg_plan_events_updated_at
  BEFORE UPDATE ON public.plan_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. plan_schedule_items
CREATE TABLE public.plan_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.competition_plans(id) ON DELETE CASCADE,
  plan_event_id uuid NOT NULL REFERENCES public.plan_events(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.plan_venues(id) ON DELETE CASCADE,
  phase text NOT NULL DEFAULT 'single' CHECK (phase IN ('single','heats','final_a','final_b')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  auto_generated boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_schedule_items TO authenticated;
GRANT ALL ON public.plan_schedule_items TO service_role;
ALTER TABLE public.plan_schedule_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner via plan can manage schedule" ON public.plan_schedule_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.competition_plans p
            WHERE p.id = plan_id AND p.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.competition_plans p
            WHERE p.id = plan_id AND p.user_id = auth.uid())
  );
CREATE INDEX idx_plan_schedule_plan ON public.plan_schedule_items(plan_id);
CREATE INDEX idx_plan_schedule_event ON public.plan_schedule_items(plan_event_id);
CREATE INDEX idx_plan_schedule_venue_time ON public.plan_schedule_items(venue_id, starts_at);

-- 5. event_duration_overrides (jaettu, vain admin muokkaa)
CREATE TABLE public.event_duration_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  age_class text,
  base_min numeric NOT NULL DEFAULT 0,
  per_participant_min numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_key, age_class)
);
GRANT SELECT ON public.event_duration_overrides TO authenticated;
GRANT ALL ON public.event_duration_overrides TO service_role;
ALTER TABLE public.event_duration_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can read overrides" ON public.event_duration_overrides
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can manage overrides" ON public.event_duration_overrides
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TRIGGER trg_event_duration_overrides_updated_at
  BEFORE UPDATE ON public.event_duration_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Lajikatalogi-RPC: kerää aiempien tulosten ikäryhmä+laji-yhdistelmät kerralla.
CREATE OR REPLACE FUNCTION public.get_event_catalog()
RETURNS TABLE(age_class text, event_name_display text, event_key text, sample_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ar.age_class,
    -- Käytä yleisin tarkka nimi
    (array_agg(ar.event_name ORDER BY ar.competition_date DESC NULLS LAST))[1] AS event_name_display,
    public.event_pb_key(ar.event_name, ar.age_class) AS event_key,
    COUNT(*) AS sample_count
  FROM public.athlete_results ar
  WHERE ar.age_class IS NOT NULL
    AND ar.event_name IS NOT NULL
    AND ar.competition_date > now() - interval '4 years'
  GROUP BY ar.age_class, public.event_pb_key(ar.event_name, ar.age_class)
  HAVING COUNT(*) >= 3
$$;

GRANT EXECUTE ON FUNCTION public.get_event_catalog() TO authenticated;