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
    AND ar.competition_date >= now() - interval '3 years'
  GROUP BY ar.age_class, public.event_pb_key(ar.event_name, ar.age_class)
  HAVING COUNT(*) >= 1
$$;

CREATE INDEX IF NOT EXISTS idx_ar_age_event_date
  ON public.athlete_results(age_class, event_name, competition_date);