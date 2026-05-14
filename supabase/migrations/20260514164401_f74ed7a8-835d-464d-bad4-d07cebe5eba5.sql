ALTER TABLE public.athlete_results
  ADD COLUMN IF NOT EXISTS was_pb boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.normalize_event_name(name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(regexp_replace(coalesce(name, ''), '^(?:[MNTmnt][0-9]*|[Pp][0-9]+)\s+', ''))
$$;

CREATE INDEX IF NOT EXISTS idx_athlete_results_pb_lookup
  ON public.athlete_results (athlete_key, (public.normalize_event_name(event_name)), captured_at);

-- Backfill: chronological running best per (athlete, normalized event)
WITH base AS (
  SELECT
    id,
    athlete_key,
    public.normalize_event_name(event_name) AS norm_event,
    event_category,
    result_numeric,
    captured_at
  FROM public.athlete_results
  WHERE result_numeric IS NOT NULL
),
running AS (
  SELECT
    id,
    athlete_key,
    norm_event,
    event_category,
    result_numeric,
    captured_at,
    CASE
      WHEN event_category = 'Track'
        THEN MIN(result_numeric) OVER (
          PARTITION BY athlete_key, norm_event
          ORDER BY captured_at, id
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        )
      ELSE MAX(result_numeric) OVER (
        PARTITION BY athlete_key, norm_event
        ORDER BY captured_at, id
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      )
    END AS prev_best
  FROM base
)
UPDATE public.athlete_results ar
SET was_pb = true
FROM running r
WHERE ar.id = r.id
  AND (
    r.prev_best IS NULL
    OR (r.event_category = 'Track' AND r.result_numeric < r.prev_best)
    OR (r.event_category <> 'Track' AND r.result_numeric > r.prev_best)
  );