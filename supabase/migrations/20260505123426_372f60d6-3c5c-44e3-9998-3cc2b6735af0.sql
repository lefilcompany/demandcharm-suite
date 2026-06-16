
CREATE OR REPLACE FUNCTION public.create_board_with_services(
  p_team_id uuid,
  p_name text,
  p_description text DEFAULT NULL::text,
  p_services jsonb DEFAULT '[]'::jsonb,
  p_stages jsonb DEFAULT NULL::jsonb,
  p_members jsonb DEFAULT '[]'::jsonb
)
RETURNS boards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_new_board public.boards;
  v_service JSONB;
  v_service_id UUID;
  v_monthly_limit INTEGER;
  v_stage JSONB;
  v_member JSONB;
  v_status_id UUID;
  v_position INTEGER;
  v_adj adjustment_type;
  v_member_user_id UUID;
  v_member_role team_role;
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

  -- Add creator as board admin
  INSERT INTO public.board_members (board_id, user_id, role, added_by)
  VALUES (v_new_board.id, v_user_id, 'admin', v_user_id)
  ON CONFLICT (board_id, user_id) DO NOTHING;

  -- Add ALL team admins as moderator
  INSERT INTO public.board_members (board_id, user_id, role, added_by)
  SELECT v_new_board.id, tm.user_id, 'moderator'::team_role, v_user_id
  FROM public.team_members tm
  WHERE tm.team_id = p_team_id
    AND tm.role = 'admin'
    AND tm.user_id != v_user_id
  ON CONFLICT (board_id, user_id) DO NOTHING;

  -- Add additional explicit members from p_members [{user_id, role}]
  IF p_members IS NOT NULL AND jsonb_array_length(p_members) > 0 THEN
    FOR v_member IN SELECT * FROM jsonb_array_elements(p_members)
    LOOP
      v_member_user_id := (v_member->>'user_id')::UUID;
      v_member_role := COALESCE(NULLIF(v_member->>'role', ''), 'executor')::team_role;

      -- only add if user belongs to team
      IF EXISTS (SELECT 1 FROM public.team_members WHERE team_id = p_team_id AND user_id = v_member_user_id) THEN
        INSERT INTO public.board_members (board_id, user_id, role, added_by)
        VALUES (v_new_board.id, v_member_user_id, v_member_role, v_user_id)
        ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role;
      END IF;
    END LOOP;
  END IF;

  -- Stages: use provided or defaults. p_stages = [{name, color, adjustment_type}]
  IF p_stages IS NULL OR jsonb_array_length(p_stages) = 0 THEN
    p_stages := '[
      {"name":"A Iniciar","color":"#6B7280","adjustment_type":"none"},
      {"name":"Fazendo","color":"#3B82F6","adjustment_type":"none"},
      {"name":"Aprovação Interna","color":"#3B82F6","adjustment_type":"internal"},
      {"name":"Em Ajuste","color":"#9333EA","adjustment_type":"none"},
      {"name":"Entregue","color":"#10B981","adjustment_type":"none"}
    ]'::jsonb;
  END IF;

  v_position := 0;
  FOR v_stage IN SELECT * FROM jsonb_array_elements(p_stages)
  LOOP
    v_adj := COALESCE(NULLIF(v_stage->>'adjustment_type',''), 'none')::adjustment_type;

    INSERT INTO public.demand_statuses (name, color, board_id, is_system)
    VALUES (
      trim(v_stage->>'name'),
      COALESCE(NULLIF(v_stage->>'color',''), '#6B7280'),
      v_new_board.id,
      true
    )
    RETURNING id INTO v_status_id;

    INSERT INTO public.board_statuses (board_id, status_id, position, is_active, adjustment_type)
    VALUES (v_new_board.id, v_status_id, v_position, true, v_adj);

    v_position := v_position + 1;
  END LOOP;

  -- Ensure "Entregue" exists at the end
  IF NOT EXISTS (
    SELECT 1 FROM public.demand_statuses
    WHERE board_id = v_new_board.id AND lower(name) = 'entregue'
  ) THEN
    INSERT INTO public.demand_statuses (name, color, board_id, is_system)
    VALUES ('Entregue', '#10B981', v_new_board.id, true)
    RETURNING id INTO v_status_id;

    INSERT INTO public.board_statuses (board_id, status_id, position, is_active, adjustment_type)
    VALUES (v_new_board.id, v_status_id, v_position, true, 'none'::adjustment_type);
  END IF;

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
$function$;
