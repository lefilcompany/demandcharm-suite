-- 1. Create function to sync admin to all boards when role changes
CREATE OR REPLACE FUNCTION public.sync_admin_to_all_boards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only execute if role was changed to 'admin'
  IF NEW.role = 'admin' AND (OLD.role IS NULL OR OLD.role != 'admin') THEN
    -- Add user to all boards of the team as admin
    INSERT INTO public.board_members (board_id, user_id, role, added_by)
    SELECT 
      b.id,
      NEW.user_id,
      'admin'::team_role,
      NEW.user_id
    FROM public.boards b
    WHERE b.team_id = NEW.team_id
    ON CONFLICT (board_id, user_id) 
    DO UPDATE SET role = 'admin'::team_role;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Create trigger for role changes on team_members
DROP TRIGGER IF EXISTS on_team_member_role_changed ON public.team_members;
CREATE TRIGGER on_team_member_role_changed
  AFTER UPDATE OF role ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admin_to_all_boards();

-- 3. Modify add_member_to_default_board to handle admins differently
CREATE OR REPLACE FUNCTION public.add_member_to_default_board()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    -- Admins: add to ALL boards of the team
    INSERT INTO public.board_members (board_id, user_id, role, added_by)
    SELECT b.id, NEW.user_id, 'admin'::team_role, NEW.user_id
    FROM public.boards b
    WHERE b.team_id = NEW.team_id
    ON CONFLICT (board_id, user_id) DO UPDATE SET role = 'admin'::team_role;
  ELSE
    -- Others: add only to default board as requester
    INSERT INTO public.board_members (board_id, user_id, role, added_by)
    SELECT b.id, NEW.user_id, 'requester'::team_role, NEW.user_id
    FROM public.boards b
    WHERE b.team_id = NEW.team_id AND b.is_default = true
    ON CONFLICT (board_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Modify create_board_with_services to add all team admins
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
  
  -- Add ALL team admins to the new board (not just creator)
  INSERT INTO public.board_members (board_id, user_id, role, added_by)
  SELECT 
    v_new_board.id,
    tm.user_id,
    'admin'::team_role,
    v_user_id
  FROM public.team_members tm
  WHERE tm.team_id = p_team_id 
    AND tm.role = 'admin'
    AND tm.user_id != v_user_id  -- Creator already added
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

-- 5. Migrate existing data: sync current admins with all boards
INSERT INTO public.board_members (board_id, user_id, role, added_by)
SELECT b.id, tm.user_id, 'admin'::team_role, tm.user_id
FROM public.team_members tm
JOIN public.boards b ON b.team_id = tm.team_id
WHERE tm.role = 'admin'
ON CONFLICT (board_id, user_id) DO UPDATE SET role = 'admin'::team_role;