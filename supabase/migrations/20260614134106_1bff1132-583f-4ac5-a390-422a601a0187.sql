
ALTER TABLE public.competition_plans
  ADD COLUMN IF NOT EXISTS is_multi_day boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS day_windows jsonb;

ALTER TABLE public.plan_events
  ADD COLUMN IF NOT EXISTS allowed_days date[];

-- Täysi lajikatalogi (alennettu kynnys, ei aikarajaa)
CREATE OR REPLACE FUNCTION public.get_event_catalog_full()
RETURNS TABLE(age_class text, event_name_display text, event_key text, sample_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ar.age_class,
    (array_agg(ar.event_name ORDER BY ar.competition_date DESC NULLS LAST))[1] AS event_name_display,
    public.event_pb_key(ar.event_name, ar.age_class) AS event_key,
    COUNT(*) AS sample_count
  FROM public.athlete_results ar
  WHERE ar.age_class IS NOT NULL
    AND ar.event_name IS NOT NULL
  GROUP BY ar.age_class, public.event_pb_key(ar.event_name, ar.age_class)
  HAVING COUNT(*) >= 1
$$;

GRANT EXECUTE ON FUNCTION public.get_event_catalog_full() TO authenticated;

-- Vuoden kilpailut suunnitelman pohjaksi
CREATE OR REPLACE FUNCTION public.list_planner_template_competitions(p_year int)
RETURNS TABLE(
  competition_id integer,
  competition_name text,
  competition_date timestamptz,
  location text,
  result_count bigint,
  age_class_count bigint,
  event_count bigint,
  duration_days integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ar.competition_id,
    (array_agg(ar.competition_name ORDER BY ar.captured_at DESC NULLS LAST))[1] AS competition_name,
    min(ar.competition_date) AS competition_date,
    (array_agg(ar.location ORDER BY ar.captured_at DESC NULLS LAST))[1] AS location,
    COUNT(*) AS result_count,
    COUNT(DISTINCT ar.age_class) AS age_class_count,
    COUNT(DISTINCT public.event_pb_key(ar.event_name, ar.age_class)) AS event_count,
    GREATEST(1,
      (EXTRACT(EPOCH FROM (max(ar.captured_at) - min(ar.captured_at)))/86400)::int + 1
    ) AS duration_days
  FROM public.athlete_results ar
  WHERE ar.competition_id IS NOT NULL
    AND EXTRACT(YEAR FROM ar.competition_date) = p_year
  GROUP BY ar.competition_id
  HAVING COUNT(*) >= 10
  ORDER BY min(ar.competition_date) DESC
$$;

GRANT EXECUTE ON FUNCTION public.list_planner_template_competitions(int) TO authenticated;

-- Kilpailun rakenteen haku suunnitelman pohjaksi
CREATE OR REPLACE FUNCTION public.get_competition_structure(p_competition_id int)
RETURNS TABLE(
  age_class text,
  event_name_display text,
  event_key text,
  participants bigint,
  first_capture timestamptz,
  last_capture timestamptz,
  duration_min integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ar.age_class,
    (array_agg(ar.event_name ORDER BY ar.captured_at DESC NULLS LAST))[1] AS event_name_display,
    public.event_pb_key(ar.event_name, ar.age_class) AS event_key,
    COUNT(DISTINCT ar.athlete_key) AS participants,
    min(ar.captured_at) AS first_capture,
    max(ar.captured_at) AS last_capture,
    GREATEST(5,
      (EXTRACT(EPOCH FROM (max(ar.captured_at) - min(ar.captured_at)))/60)::int
    ) AS duration_min
  FROM public.athlete_results ar
  WHERE ar.competition_id = p_competition_id
    AND ar.age_class IS NOT NULL
    AND ar.event_name IS NOT NULL
  GROUP BY ar.age_class, public.event_pb_key(ar.event_name, ar.age_class)
$$;

GRANT EXECUTE ON FUNCTION public.get_competition_structure(int) TO authenticated;
