DO $$
BEGIN
  PERFORM cron.unschedule('harvest-hot-15s');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;