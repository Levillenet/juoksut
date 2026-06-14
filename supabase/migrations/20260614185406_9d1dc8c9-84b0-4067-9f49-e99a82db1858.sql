ALTER TABLE public.event_duration_stats
  ADD COLUMN IF NOT EXISTS p10_duration_min REAL;