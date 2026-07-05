DO $$
DECLARE
  c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'public.result_videos'::regclass
    AND contype = 'u';
  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.result_videos DROP CONSTRAINT %I', c_name);
  END IF;
END $$;