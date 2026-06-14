UPDATE public.plan_venues
SET kind = 'shot_ring'
WHERE kind = 'throw_ring' AND lower(name) LIKE '%kuula%';

UPDATE public.plan_venues
SET kind = 'throw_cage'
WHERE kind = 'throw_ring' AND (lower(name) LIKE '%moukari%' OR lower(name) LIKE '%kiekko%');