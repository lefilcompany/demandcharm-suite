
-- Create a secure function to verify note share tokens without exposing all tokens
CREATE OR REPLACE FUNCTION public.verify_note_share_token(p_token text)
RETURNS TABLE(id uuid, note_id uuid, is_active boolean, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, note_id, is_active, expires_at
  FROM note_share_tokens
  WHERE token = p_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());
$$;

-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Public can verify share tokens" ON public.note_share_tokens;
