
ALTER TABLE public.result_videos ADD COLUMN IF NOT EXISTS heat_results jsonb;

CREATE OR REPLACE FUNCTION public.set_heat_results_if_null(_video_id uuid, _snapshot jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF _snapshot IS NULL OR jsonb_typeof(_snapshot) <> 'array' OR jsonb_array_length(_snapshot) = 0 THEN
    RETURN false;
  END IF;
  UPDATE public.result_videos
  SET heat_results = _snapshot
  WHERE id = _video_id
    AND heat_results IS NULL
    AND athlete_key LIKE 'heat:%'
    AND is_public = true;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_heat_results_if_null(uuid, jsonb) TO anon, authenticated;
