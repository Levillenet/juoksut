WITH ranked AS (
  SELECT
    ar.id,
    ar.was_pb AS current_pb,
    ar.event_category,
    ar.result_numeric,
    MIN(ar.result_numeric) FILTER (WHERE ar.event_category = 'Track') OVER (
      PARTITION BY ar.athlete_key, public.normalize_event_name(ar.event_name)
      ORDER BY ar.competition_date, ar.captured_at, ar.id
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS prev_min,
    MAX(ar.result_numeric) FILTER (WHERE ar.event_category <> 'Track') OVER (
      PARTITION BY ar.athlete_key, public.normalize_event_name(ar.event_name)
      ORDER BY ar.competition_date, ar.captured_at, ar.id
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS prev_max
  FROM public.athlete_results ar
  WHERE ar.result_numeric IS NOT NULL
),
computed AS (
  SELECT
    id,
    current_pb,
    CASE
      WHEN event_category = 'Track' THEN (prev_min IS NULL OR result_numeric < prev_min)
      ELSE (prev_max IS NULL OR result_numeric > prev_max)
    END AS new_pb
  FROM ranked
)
UPDATE public.athlete_results ar
SET was_pb = c.new_pb
FROM computed c
WHERE ar.id = c.id
  AND c.new_pb IS DISTINCT FROM c.current_pb;