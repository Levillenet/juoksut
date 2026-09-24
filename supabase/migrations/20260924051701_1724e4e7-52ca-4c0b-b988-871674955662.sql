UPDATE public.harvest_state
SET blocked = true,
    block_reason = 'Yleisurheilukauden kausitauko',
    block_since = COALESCE(block_since, now()),
    block_checked_at = now(),
    updated_at = now()
WHERE id = 'singleton';