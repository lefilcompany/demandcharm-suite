
-- =============================================
-- FIX 1: Remove vulnerable team_members INSERT policy
-- that allows any user to join any team with any role
-- =============================================
DROP POLICY IF EXISTS "Users can join teams with access code" ON team_members;

-- Create a secure RPC for joining teams that validates access code server-side
CREATE OR REPLACE FUNCTION public.join_team_with_code(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate and find team by access code
  SELECT id INTO v_team_id 
  FROM teams 
  WHERE access_code = upper(trim(p_code));

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Invalid access code';
  END IF;

  -- Insert as member only - never allow self-assigning higher roles
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (v_team_id, v_user_id, 'member');

  RETURN v_team_id;
END;
$$;

-- =============================================
-- FIX 2: Remove anonymous SELECT policies on teams
-- that expose the access_code column to unauthenticated users
-- =============================================
DROP POLICY IF EXISTS "Anonymous can view team basic info for shared demands" ON teams;
DROP POLICY IF EXISTS "Authenticated can view team info for shared content" ON teams;

-- =============================================
-- FIX 3: Remove public SELECT policies on share token tables
-- that allow enumeration of all active tokens.
-- Token verification is handled by SECURITY DEFINER RPCs
-- (verify_note_share_token, verify_demand_share_token) and
-- edge functions (shared-demand, shared-attachment-url)
-- =============================================
DROP POLICY IF EXISTS "Public can verify share tokens" ON demand_share_tokens;
DROP POLICY IF EXISTS "Authenticated can verify share tokens" ON demand_share_tokens;
DROP POLICY IF EXISTS "Public can verify share tokens" ON note_share_tokens;
