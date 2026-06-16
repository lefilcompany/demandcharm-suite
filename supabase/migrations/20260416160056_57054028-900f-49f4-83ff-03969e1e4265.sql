
-- Fix create_board_with_services: only add the creator, not all team admins
CREATE OR REPLACE FUNCTION public.create_board_with_services(p_team_id uuid, p_name text, p_description text DEFAULT NULL::text, p_services jsonb DEFAULT '[]'::jsonb)
RETURNS boards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_new_board public.boards;
  v_service JSONB;
  v_service_id UUID;
  v_monthly_limit INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'PGRST301';
  END IF;
  
  IF NOT public.is_team_admin_or_moderator(v_user_id, p_team_id) THEN
    RAISE EXCEPTION 'Permission denied: must be team admin or moderator' USING ERRCODE = '42501';
  END IF;
  
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Board name is required' USING ERRCODE = '22000';
  END IF;
  
  IF length(trim(p_name)) > 100 THEN
    RAISE EXCEPTION 'Board name too long (max 100 characters)' USING ERRCODE = '22000';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM public.boards 
    WHERE team_id = p_team_id 
    AND lower(trim(name)) = lower(trim(p_name))
  ) THEN
    RAISE EXCEPTION 'A board with this name already exists' USING ERRCODE = '23505';
  END IF;
  
  INSERT INTO public.boards (team_id, name, description, created_by, is_default, monthly_demand_limit)
  VALUES (p_team_id, trim(p_name), nullif(trim(p_description), ''), v_user_id, false, 0)
  RETURNING * INTO v_new_board;
  
  -- Add creator as board admin (only the creator, not all team admins)
  INSERT INTO public.board_members (board_id, user_id, role, added_by)
  VALUES (v_new_board.id, v_user_id, 'admin', v_user_id)
  ON CONFLICT (board_id, user_id) DO NOTHING;
  
  -- Add board services if provided
  IF p_services IS NOT NULL AND jsonb_array_length(p_services) > 0 THEN
    FOR v_service IN SELECT * FROM jsonb_array_elements(p_services)
    LOOP
      v_service_id := (v_service->>'service_id')::UUID;
      v_monthly_limit := COALESCE((v_service->>'monthly_limit')::INTEGER, 0);
      
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
