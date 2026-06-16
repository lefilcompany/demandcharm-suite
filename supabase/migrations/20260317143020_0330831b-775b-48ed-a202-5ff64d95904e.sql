-- Deactivate tokens that are active but already expired
UPDATE public.demand_share_tokens 
SET is_active = false 
WHERE is_active = true 
  AND expires_at IS NOT NULL 
  AND expires_at <= now();