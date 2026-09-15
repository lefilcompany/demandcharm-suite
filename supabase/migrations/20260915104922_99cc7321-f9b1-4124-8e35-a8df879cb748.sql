-- 1) Converter subdemanda em solicitação pendente
CREATE OR REPLACE FUNCTION public.convert_subdemand_to_request(p_demand_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_demand public.demands;
  v_request_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'PGRST301';
  END IF;

  SELECT * INTO v_demand FROM public.demands WHERE id = p_demand_id;
  IF v_demand.id IS NULL THEN
    RAISE EXCEPTION 'Demanda não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_demand.parent_demand_id IS NULL THEN
    RAISE EXCEPTION 'Esta demanda não é uma subdemanda' USING ERRCODE = '22000';
  END IF;

  IF v_demand.archived THEN
    RAISE EXCEPTION 'Esta subdemanda já foi removida do quadro' USING ERRCODE = '22000';
  END IF;

  IF NOT public.is_board_member(v_user_id, v_demand.board_id) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.demand_dependencies dd
    JOIN public.demands d ON d.id = dd.demand_id
    WHERE dd.depends_on_demand_id = p_demand_id
      AND d.archived = false
  ) THEN
    RAISE EXCEPTION 'Outra subdemanda depende desta. Remova a dependência antes de enviá-la para Solicitações.' USING ERRCODE = '22000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.demands c WHERE c.parent_demand_id = p_demand_id AND c.archived = false
  ) THEN
    RAISE EXCEPTION 'Esta subdemanda possui subdemandas e não pode ser enviada para Solicitações.' USING ERRCODE = '22000';
  END IF;

  INSERT INTO public.demand_requests (
    team_id, board_id, created_by, title, description, priority, service_id, status
  ) VALUES (
    v_demand.team_id,
    v_demand.board_id,
    v_user_id,
    v_demand.title,
    v_demand.description,
    COALESCE(v_demand.priority, 'média'),
    v_demand.service_id,
    'pending'
  )
  RETURNING id INTO v_request_id;

  DELETE FROM public.demand_dependencies WHERE demand_id = p_demand_id OR depends_on_demand_id = p_demand_id;

  UPDATE public.demands
  SET parent_demand_id = NULL,
      subdemand_sort_order = NULL,
      archived = true,
      archived_at = now(),
      trash_expires_at = now() + interval '30 days',
      updated_at = now()
  WHERE id = p_demand_id;

  RETURN v_request_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.convert_subdemand_to_request(uuid) TO authenticated;

-- 2) Backlog em todos os quadros existentes
DO $do$
DECLARE
  v_board RECORD;
  v_status_id uuid;
  v_pos integer;
BEGIN
  FOR v_board IN SELECT id FROM public.boards LOOP
    IF EXISTS (
      SELECT 1 FROM public.board_statuses bs
      JOIN public.demand_statuses ds ON ds.id = bs.status_id
      WHERE bs.board_id = v_board.id AND lower(trim(ds.name)) = 'backlog'
    ) THEN
      CONTINUE;
    END IF;

    SELECT id INTO v_status_id
    FROM public.demand_statuses
    WHERE board_id = v_board.id AND lower(trim(name)) = 'backlog'
    LIMIT 1;

    IF v_status_id IS NULL THEN
      INSERT INTO public.demand_statuses (name, color, board_id, is_system)
      VALUES ('Backlog', '#64748B', v_board.id, false)
      RETURNING id INTO v_status_id;
    END IF;

    SELECT COALESCE(MIN(position), 0) - 1 INTO v_pos
    FROM public.board_statuses WHERE board_id = v_board.id;

    INSERT INTO public.board_statuses (board_id, status_id, position, is_active, adjustment_type)
    VALUES (v_board.id, v_status_id, v_pos, true, 'none'::adjustment_type)
    ON CONFLICT DO NOTHING;
  END LOOP;
END
$do$;

-- 3) Novos quadros já nascem com Backlog
CREATE OR REPLACE FUNCTION public.create_board_with_services(p_team_id uuid, p_name text, p_description text DEFAULT NULL::text, p_services jsonb DEFAULT '[]'::jsonb, p_stages jsonb DEFAULT NULL::jsonb, p_members jsonb DEFAULT '[]'::jsonb)
 RETURNS boards
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_user_id UUID := auth.uid(); v_new_board public.boards; v_trim_name TEXT := trim(p_name); v_stages jsonb := p_stages; v_invalid_service UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'PGRST301'; END IF;
  IF NOT public.is_team_admin_or_moderator(v_user_id, p_team_id) THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501'; END IF;
  IF v_trim_name IS NULL OR v_trim_name = '' THEN RAISE EXCEPTION 'Board name is required' USING ERRCODE = '22000'; END IF;
  IF length(v_trim_name) > 100 THEN RAISE EXCEPTION 'Board name too long' USING ERRCODE = '22000'; END IF;
  IF EXISTS (SELECT 1 FROM public.boards WHERE team_id = p_team_id AND lower(trim(name)) = lower(v_trim_name)) THEN
    RAISE EXCEPTION 'A board with this name already exists' USING ERRCODE = '23505';
  END IF;
  IF v_stages IS NULL OR jsonb_typeof(v_stages) <> 'array' OR jsonb_array_length(v_stages) = 0 THEN
    v_stages := '[{"name":"A Iniciar","color":"#6B7280","adjustment_type":"none"},{"name":"Fazendo","color":"#3B82F6","adjustment_type":"none"},{"name":"Aprovação Interna","color":"#3B82F6","adjustment_type":"internal"},{"name":"Em Ajuste","color":"#9333EA","adjustment_type":"none"},{"name":"Entregue","color":"#10B981","adjustment_type":"none"}]'::jsonb;
  END IF;
  -- Backlog sempre como primeira etapa
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_stages) s WHERE lower(trim(s.value->>'name')) = 'backlog'
  ) THEN
    v_stages := '[{"name":"Backlog","color":"#64748B","adjustment_type":"none"}]'::jsonb || v_stages;
  END IF;
  IF p_services IS NOT NULL AND jsonb_typeof(p_services) = 'array' AND jsonb_array_length(p_services) > 0 THEN
    SELECT (s->>'service_id')::uuid INTO v_invalid_service FROM jsonb_array_elements(p_services) s
    WHERE NOT EXISTS (SELECT 1 FROM public.services sv WHERE sv.id = (s->>'service_id')::uuid AND sv.team_id = p_team_id) LIMIT 1;
    IF v_invalid_service IS NOT NULL THEN RAISE EXCEPTION 'Service % does not belong to this team', v_invalid_service USING ERRCODE = '22000'; END IF;
  END IF;
  INSERT INTO public.boards (team_id, name, description, created_by, is_default, monthly_demand_limit)
  VALUES (p_team_id, v_trim_name, nullif(trim(p_description), ''), v_user_id, false, 0)
  RETURNING * INTO v_new_board;
  WITH base AS (
    SELECT v_user_id AS user_id, 'admin'::team_role AS role, 1 AS prio
    UNION ALL SELECT (m->>'user_id')::uuid, COALESCE(NULLIF(m->>'role',''), 'executor')::team_role, 2
    FROM jsonb_array_elements(COALESCE(p_members, '[]'::jsonb)) m
    WHERE EXISTS (SELECT 1 FROM public.team_members tm2 WHERE tm2.team_id = p_team_id AND tm2.user_id = (m->>'user_id')::uuid)
  ), ranked AS (SELECT user_id, role, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY prio) AS rn FROM base)
  INSERT INTO public.board_members (board_id, user_id, role, added_by)
  SELECT v_new_board.id, user_id, role, v_user_id FROM ranked WHERE rn = 1
  ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  WITH stages_in AS (
    SELECT ord - 1 AS pos, trim(s.value->>'name') AS name,
      COALESCE(NULLIF(s.value->>'color',''), '#6B7280') AS color,
      COALESCE(NULLIF(s.value->>'adjustment_type',''), 'none')::adjustment_type AS adj
    FROM jsonb_array_elements(v_stages) WITH ORDINALITY AS s(value, ord)
  ), inserted_status AS (
    INSERT INTO public.demand_statuses (name, color, board_id, is_system)
    SELECT name, color, v_new_board.id, true FROM stages_in ORDER BY pos
    RETURNING id, name
  ), pairs AS (
    SELECT si.pos, si.adj, (SELECT i.id FROM inserted_status i WHERE i.name = si.name LIMIT 1) AS status_id FROM stages_in si
  )
  INSERT INTO public.board_statuses (board_id, status_id, position, is_active, adjustment_type)
  SELECT v_new_board.id, status_id, pos, true, adj FROM pairs WHERE status_id IS NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM public.demand_statuses WHERE board_id = v_new_board.id AND lower(name) = 'entregue') THEN
    WITH ins AS (INSERT INTO public.demand_statuses (name, color, board_id, is_system) VALUES ('Entregue', '#10B981', v_new_board.id, true) RETURNING id)
    INSERT INTO public.board_statuses (board_id, status_id, position, is_active, adjustment_type)
    SELECT v_new_board.id, ins.id, COALESCE((SELECT MAX(position) + 1 FROM public.board_statuses WHERE board_id = v_new_board.id), 0), true, 'none'::adjustment_type FROM ins;
  END IF;
  IF p_services IS NOT NULL AND jsonb_typeof(p_services) = 'array' AND jsonb_array_length(p_services) > 0 THEN
    INSERT INTO public.board_services (board_id, service_id, monthly_limit)
    SELECT v_new_board.id, (s->>'service_id')::uuid, COALESCE((s->>'monthly_limit')::int, 0)
    FROM jsonb_array_elements(p_services) s ON CONFLICT DO NOTHING;
  END IF;
  RETURN v_new_board;
END;
$function$;