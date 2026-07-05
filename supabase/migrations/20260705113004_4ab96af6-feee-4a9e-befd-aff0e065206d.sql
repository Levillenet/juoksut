
-- 19 nykyseuraa Lahden piirissä
CREATE TABLE public.lahti_district_clubs (
  club_name TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lahti_district_clubs TO anon, authenticated;
GRANT ALL ON public.lahti_district_clubs TO service_role;
ALTER TABLE public.lahti_district_clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kaikki voivat lukea seuralistan" ON public.lahti_district_clubs FOR SELECT USING (true);
CREATE POLICY "Vain admin voi muokata seuralistaa" ON public.lahti_district_clubs FOR ALL
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

INSERT INTO public.lahti_district_clubs (club_name) VALUES
  ('Artjärven Ahjo'),('Asikkalan Raikas'),('Hartolan Voima'),('Heinolan Isku'),
  ('Herralan Hukat'),('Hollolan Nasta'),('Iitin Pyrintö'),('Joutsan Pommi'),
  ('Kuhmoisten Kumu'),('Kärkölän Kisa-Veikot'),('Lahden Ahkera'),('LahtiSport'),
  ('Myrskylän Myrsky'),('Nastolan Naseva'),('Orimattilan Jymy'),('Orimattilan Toive'),
  ('Padasjoen Yritys'),('Pertunmaan Ponnistajat'),('Sysmän Sisu');

-- Voimassa olevat piiriennätykset
CREATE TABLE public.district_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gender TEXT NOT NULL CHECK (gender IN ('M','F')),
  age_class TEXT NOT NULL,
  event_name_raw TEXT NOT NULL,
  event_pb_key TEXT NOT NULL,
  result_text TEXT NOT NULL,
  result_numeric DOUBLE PRECISION,
  record_holder TEXT NOT NULL,
  birth_year INTEGER,
  club TEXT NOT NULL,
  record_year INTEGER,
  indoor BOOLEAN NOT NULL DEFAULT false,
  wind_or_manual TEXT,
  notes TEXT,
  source_page INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (age_class, event_pb_key)
);
CREATE INDEX idx_district_records_age_event ON public.district_records (age_class, event_pb_key);
CREATE INDEX idx_district_records_holder ON public.district_records (record_holder, birth_year);
GRANT SELECT ON public.district_records TO anon, authenticated;
GRANT ALL ON public.district_records TO service_role;
ALTER TABLE public.district_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kaikki voivat lukea piiriennätykset" ON public.district_records FOR SELECT USING (true);
CREATE POLICY "Vain admin voi muokata piiriennätyksiä" ON public.district_records FOR ALL
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE TRIGGER update_district_records_updated_at BEFORE UPDATE ON public.district_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Rikottujen ennätysten historia
CREATE TABLE public.district_record_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_key TEXT NOT NULL,
  athlete_result_id UUID REFERENCES public.athlete_results(id) ON DELETE CASCADE,
  age_class TEXT NOT NULL,
  event_pb_key TEXT NOT NULL,
  previous_record_id UUID,
  previous_result_numeric DOUBLE PRECISION,
  previous_holder TEXT,
  previous_club TEXT,
  previous_year INTEGER,
  new_result_numeric DOUBLE PRECISION,
  new_holder TEXT,
  new_club TEXT,
  competition_id INTEGER,
  competition_name TEXT,
  competition_date TIMESTAMPTZ,
  broken_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_drb_broken_at ON public.district_record_breaks (broken_at DESC);
CREATE INDEX idx_drb_athlete ON public.district_record_breaks (athlete_key);
GRANT SELECT ON public.district_record_breaks TO anon, authenticated;
GRANT ALL ON public.district_record_breaks TO service_role;
ALTER TABLE public.district_record_breaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kaikki voivat lukea PE-historian" ON public.district_record_breaks FOR SELECT USING (true);
CREATE POLICY "Vain admin voi muokata PE-historiaa" ON public.district_record_breaks FOR ALL
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Lippukenttä tulokseen
ALTER TABLE public.athlete_results ADD COLUMN IF NOT EXISTS was_district_record BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_athlete_results_was_dr ON public.athlete_results (was_district_record) WHERE was_district_record = true;
