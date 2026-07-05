ALTER TABLE public.harvest_competitions ADD COLUMN IF NOT EXISTS first_scanned_at timestamptz;
UPDATE public.harvest_competitions SET first_scanned_at = last_scanned_at WHERE first_scanned_at IS NULL;
UPDATE public.harvest_competitions SET done = false WHERE exists_in_source = false AND done = true AND (first_scanned_at IS NULL OR first_scanned_at > now() - interval '30 days');