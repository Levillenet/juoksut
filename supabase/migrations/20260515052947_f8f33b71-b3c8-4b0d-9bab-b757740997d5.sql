ALTER TABLE public.harvest_state ALTER COLUMN next_id SET DEFAULT 16456;
ALTER TABLE public.harvest_state ALTER COLUMN latest_id SET DEFAULT 16456;
UPDATE public.harvest_state SET next_id = 16456, updated_at = now() WHERE id = 'singleton' AND next_id > 16456;