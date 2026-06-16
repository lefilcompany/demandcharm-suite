-- Create a security definer function to get shared summary by token
-- This bypasses RLS to allow public access to valid shared summaries
CREATE OR REPLACE FUNCTION public.get_shared_board_summary(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_token_record record;
BEGIN
  -- Get the token record
  SELECT 
    bsst.id,
    bsst.is_active,
    bsst.expires_at,
    bsst.summary_id
  INTO v_token_record
  FROM board_summary_share_tokens bsst
  WHERE bsst.token = p_token;
  
  -- Check if token exists
  IF v_token_record IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Check if token is active
  IF NOT v_token_record.is_active THEN
    RETURN NULL;
  END IF;
  
  -- Check if token is expired
  IF v_token_record.expires_at IS NOT NULL AND v_token_record.expires_at < now() THEN
    RETURN NULL;
  END IF;
  
  -- Get the summary data with board info
  SELECT jsonb_build_object(
    'id', bsh.id,
    'summary_text', bsh.summary_text,
    'analytics_data', bsh.analytics_data,
    'created_at', bsh.created_at,
    'board', jsonb_build_object('name', b.name)
  )
  INTO v_result
  FROM board_summary_history bsh
  LEFT JOIN boards b ON b.id = bsh.board_id
  WHERE bsh.id = v_token_record.summary_id;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION public.get_shared_board_summary(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_shared_board_summary(text) TO authenticated;