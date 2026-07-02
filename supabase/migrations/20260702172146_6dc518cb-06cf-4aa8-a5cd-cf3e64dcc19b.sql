
CREATE INDEX IF NOT EXISTS idx_ar_pbkey_result
  ON public.athlete_results (
    athlete_key,
    public.event_pb_key(event_name, age_class),
    result_numeric,
    competition_date,
    captured_at
  )
  WHERE result_numeric IS NOT NULL;
