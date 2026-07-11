SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'harvest-hot-15s' LIMIT 1),
  schedule := '*/5 * * * *'
);