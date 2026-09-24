DO $$
DECLARE
  seasonal_job text;
BEGIN
  FOREACH seasonal_job IN ARRAY ARRAY[
    'harvest-tuloslista',
    'harvest-hot-15s',
    'tuloslista-monitor',
    'harvest-kilpailukalenteri-daily'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = seasonal_job) THEN
      PERFORM cron.unschedule(seasonal_job);
    END IF;
  END LOOP;
END $$;

UPDATE public.welcome_messages
SET title = 'Palvelu on kausitauolla',
    body = 'Yleisurheilukauden päätyttyä palvelun tulospäivitykset on laitettu tauolle. Tallennetut tulokset ja muu sisältö ovat edelleen selattavissa normaalisti. Päivitykset otetaan käyttöön tarvittaessa hallikaudelle ja viimeistään kesäkauden alkaessa.',
    enabled = true,
    updated_at = now()
WHERE singleton = true;

INSERT INTO public.welcome_messages (singleton, title, body, enabled)
SELECT true,
       'Palvelu on kausitauolla',
       'Yleisurheilukauden päätyttyä palvelun tulospäivitykset on laitettu tauolle. Tallennetut tulokset ja muu sisältö ovat edelleen selattavissa normaalisti. Päivitykset otetaan käyttöön tarvittaessa hallikaudelle ja viimeistään kesäkauden alkaessa.',
       true
WHERE NOT EXISTS (SELECT 1 FROM public.welcome_messages WHERE singleton = true);