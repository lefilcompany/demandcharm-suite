-- =============================================================================
-- REFACTOR: Board creation from scratch
-- Creates an RPC function that centralizes all board creation logic
-- =============================================================================

-- 1. Drop old INSERT policy on boards (we'll use RPC instead)
DROP POLICY IF EXISTS "Team members can create boards" ON public.boards;

-- 2. Create the main RPC function for board creation
CREATE OR REPLACE FUNCTION public.create_board_with_services(
  p_team_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_services JSONB DEFAULT '[]'::JSONB
)
RETURNS public.boards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_new_board public.boards;
  v_service JSONB;
  v_service_id UUID;
  v_monthly_limit INTEGER;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'PGRST301';
  END IF;
  
  -- Validate user is admin or moderator in the team
  IF NOT public.is_team_admin_or_moderator(v_user_id, p_team_id) THEN
    RAISE EXCEPTION 'Permission denied: must be team admin or moderator' USING ERRCODE = '42501';
  END IF;
  
  -- Validate name
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Board name is required' USING ERRCODE = '22000';
  END IF;
  
  IF length(trim(p_name)) > 100 THEN
    RAISE EXCEPTION 'Board name too long (max 100 characters)' USING ERRCODE = '22000';
  END IF;
  
  -- Check for duplicate name in team (case insensitive)
  IF EXISTS (
    SELECT 1 FROM public.boards 
    WHERE team_id = p_team_id 
    AND lower(trim(name)) = lower(trim(p_name))
  ) THEN
    RAISE EXCEPTION 'A board with this name already exists' USING ERRCODE = '23505';
  END IF;
  
  -- Create the board
  INSERT INTO public.boards (team_id, name, description, created_by, is_default, monthly_demand_limit)
  VALUES (p_team_id, trim(p_name), nullif(trim(p_description), ''), v_user_id, false, 0)
  RETURNING * INTO v_new_board;
  
  -- Add creator as board admin
  INSERT INTO public.board_members (board_id, user_id, role, added_by)
  VALUES (v_new_board.id, v_user_id, 'admin', v_user_id)
  ON CONFLICT (board_id, user_id) DO NOTHING;
  
  -- Add board services if provided
  IF p_services IS NOT NULL AND jsonb_array_length(p_services) > 0 THEN
    FOR v_service IN SELECT * FROM jsonb_array_elements(p_services)
    LOOP
      v_service_id := (v_service->>'service_id')::UUID;
      v_monthly_limit := COALESCE((v_service->>'monthly_limit')::INTEGER, 0);
      
      -- Validate service belongs to the team
      IF NOT EXISTS (
        SELECT 1 FROM public.services 
        WHERE id = v_service_id AND team_id = p_team_id
      ) THEN
        RAISE EXCEPTION 'Service % does not belong to this team', v_service_id USING ERRCODE = '22000';
      END IF;
      
      INSERT INTO public.board_services (board_id, service_id, monthly_limit)
      VALUES (v_new_board.id, v_service_id, v_monthly_limit)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  
  RETURN v_new_board;
END;
$$;

-- 3. Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_board_with_services(UUID, TEXT, TEXT, JSONB) TO authenticated;

-- 4. Drop the old trigger that adds creator to board (now handled in RPC)
DROP TRIGGER IF EXISTS on_board_created ON public.boards;

-- 5. Keep the add_creator_to_board function but it won't be triggered anymore
-- (we keep it for backwards compatibility if someone creates boards via other means)

-- 6. Ensure board_members INSERT policy allows the RPC to work
-- The RPC runs as SECURITY DEFINER so it bypasses RLS, but we need SELECT policies
-- to work for the frontend after creation

-- Make sure we have a clean SELECT policy for boards
DROP POLICY IF EXISTS "Team members can view boards" ON public.boards;
CREATE POLICY "Team members can view boards"
ON public.boards
FOR SELECT
TO authenticated
USING (
  id IN (SELECT board_id FROM public.board_members WHERE user_id = auth.uid())
  OR public.is_team_admin_or_moderator(auth.uid(), team_id)
);

-- 7. Ensure UPDATE policy exists for board admins/moderators
DROP POLICY IF EXISTS "Board admins can update boards" ON public.boards;
CREATE POLICY "Board admins can update boards"
ON public.boards
FOR UPDATE
TO authenticated
USING (public.is_board_admin_or_moderator(auth.uid(), id))
WITH CHECK (public.is_board_admin_or_moderator(auth.uid(), id));

-- 8. Ensure DELETE policy exists for board admins
DROP POLICY IF EXISTS "Board admins can delete boards" ON public.boards;
CREATE POLICY "Board admins can delete boards"
ON public.boards
FOR DELETE
TO authenticated
USING (
  public.is_board_admin_or_moderator(auth.uid(), id)
  AND is_default = false
);