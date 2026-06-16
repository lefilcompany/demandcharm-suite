-- Create secure RPC for demand share token verification
CREATE OR REPLACE FUNCTION public.verify_demand_share_token(p_token text)
RETURNS TABLE(id uuid, demand_id uuid, is_active boolean, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id, demand_id, is_active, expires_at
  FROM demand_share_tokens
  WHERE token = p_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());
$$;

-- Remove overly permissive public/anon SELECT policies
DROP POLICY IF EXISTS "Public can verify share tokens" ON public.demand_share_tokens;
DROP POLICY IF EXISTS "Authenticated can verify share tokens" ON public.demand_share_tokens;