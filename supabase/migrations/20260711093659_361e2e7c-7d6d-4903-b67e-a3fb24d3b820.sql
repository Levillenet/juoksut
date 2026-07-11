ALTER TABLE public.harvest_state
  ADD COLUMN IF NOT EXISTS last_api_message text,
  ADD COLUMN IF NOT EXISTS last_api_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_api_message_source text,
  ADD COLUMN IF NOT EXISTS last_api_message_endpoint text;