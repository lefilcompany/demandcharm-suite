
-- Update create_board_with_services to include "Tarefas Internas" before "Em Andamento"
CREATE OR REPLACE FUNCTION public.create_board_with_services(
  p_team_id UUID, p_name TEXT, p_description TEXT DEFAULT NULL, p_services JSONB DEFAULT '[]'::JSONB
)
RETURNS public.boards
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_new_board public.boards;
  v_service JSONB;
  v_service_id UUID;
  v_monthly_limit INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'PGRST301'; END IF;
  IF NOT public.is_team_owner(v_user_id, p_team_id) THEN RAISE EXCEPTION 'Permission denied: must be team owner' USING ERRCODE = '42501'; END IF;
  IF p_name IS NULL OR trim(p_name) = '' THEN RAISE EXCEPTION 'Board name is required' USING ERRCODE = '22000'; END IF;
  IF length(trim(p_name)) > 100 THEN RAISE EXCEPTION 'Board name too long (max 100 characters)' USING ERRCODE = '22000'; END IF;
  IF EXISTS (SELECT 1 FROM public.boards WHERE team_id = p_team_id AND lower(trim(name)) = lower(trim(p_name))) THEN
    RAISE EXCEPTION 'A board with this name already exists' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.boards (team_id, name, description, created_by, is_default, monthly_demand_limit)
  VALUES (p_team_id, trim(p_name), nullif(trim(p_description), ''), v_user_id, false, 0)
  RETURNING * INTO v_new_board;

  INSERT INTO public.board_members (board_id, user_id, role, added_by)
  VALUES (v_new_board.id, v_user_id, 'admin', v_user_id)
  ON CONFLICT (board_id, user_id) DO NOTHING;

  IF p_services IS NOT NULL AND jsonb_array_length(p_services) > 0 THEN
    FOR v_service IN SELECT * FROM jsonb_array_elements(p_services) LOOP
      v_service_id := (v_service->>'service_id')::UUID;
      v_monthly_limit := COALESCE((v_service->>'monthly_limit')::INTEGER, 0);
      IF EXISTS (SELECT 1 FROM public.services WHERE id = v_service_id AND team_id = p_team_id) THEN
        INSERT INTO public.board_services (board_id, service_id, monthly_limit)
        VALUES (v_new_board.id, v_service_id, v_monthly_limit) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Create default statuses including "Tarefas Internas" before "Em Andamento"
  INSERT INTO public.demand_statuses (name, color, board_id, is_system) VALUES
    ('A Fazer', '#6B7280', v_new_board.id, true),
    ('Tarefas Internas', '#8B5CF6', v_new_board.id, true),
    ('Em Andamento', '#3B82F6', v_new_board.id, true),
    ('Em Revisão', '#F59E0B', v_new_board.id, true),
    ('Entregue', '#10B981', v_new_board.id, true);

  INSERT INTO public.board_statuses (board_id, status_id, position, is_active)
  SELECT v_new_board.id, ds.id, ROW_NUMBER() OVER (ORDER BY ds.created_at) - 1, true
  FROM public.demand_statuses ds WHERE ds.board_id = v_new_board.id;

  RETURN v_new_board;
END;
$$;
