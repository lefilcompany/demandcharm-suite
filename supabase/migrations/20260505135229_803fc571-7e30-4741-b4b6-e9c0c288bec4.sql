-- Drop the legacy 4-arg overload that causes RPC ambiguity in PostgREST/supabase-js
DROP FUNCTION IF EXISTS public.create_board_with_services(uuid, text, text, jsonb);

-- Recreate the 6-arg version optimized: set-based inserts inside an explicit transactional block
CREATE OR REPLACE FUNCTION public.create_board_with_services(
  p_team_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_services jsonb DEFAULT '[]'::jsonb,
  p_stages jsonb DEFAULT NULL,
  p_members jsonb DEFAULT '[]'::jsonb
)
RETURNS public.boards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_new_board public.boards;
  v_trim_name TEXT := trim(p_name);
  v_stages jsonb := p_stages;
  v_invalid_service UUID;
  v_status_ids UUID[];
BEGIN
  -- Auth & permission checks
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'PGRST301';
  END IF;

  IF NOT public.is_team_admin_or_moderator(v_user_id, p_team_id) THEN
    RAISE EXCEPTION 'Permission denied: must be team admin or moderator' USING ERRCODE = '42501';
  END IF;

  -- Name validation
  IF v_trim_name IS NULL OR v_trim_name = '' THEN
    RAISE EXCEPTION 'Board name is required' USING ERRCODE = '22000';
  END IF;
  IF length(v_trim_name) > 100 THEN
    RAISE EXCEPTION 'Board name too long (max 100 characters)' USING ERRCODE = '22000';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.boards
    WHERE team_id = p_team_id AND lower(trim(name)) = lower(v_trim_name)
  ) THEN
    RAISE EXCEPTION 'A board with this name already exists' USING ERRCODE = '23505';
  END IF;

  -- Default stages if none provided
  IF v_stages IS NULL OR jsonb_typeof(v_stages) <> 'array' OR jsonb_array_length(v_stages) = 0 THEN
    v_stages := '[
      {"name":"A Iniciar","color":"#6B7280","adjustment_type":"none"},
      {"name":"Fazendo","color":"#3B82F6","adjustment_type":"none"},
      {"name":"Aprovação Interna","color":"#3B82F6","adjustment_type":"internal"},
      {"name":"Em Ajuste","color":"#9333EA","adjustment_type":"none"},
      {"name":"Entregue","color":"#10B981","adjustment_type":"none"}
    ]'::jsonb;
  END IF;

  -- Pre-validate services belong to the team (single query, fail fast)
  IF p_services IS NOT NULL AND jsonb_typeof(p_services) = 'array' AND jsonb_array_length(p_services) > 0 THEN
    SELECT (s->>'service_id')::uuid INTO v_invalid_service
    FROM jsonb_array_elements(p_services) s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.services sv
      WHERE sv.id = (s->>'service_id')::uuid AND sv.team_id = p_team_id
    )
    LIMIT 1;

    IF v_invalid_service IS NOT NULL THEN
      RAISE EXCEPTION 'Service % does not belong to this team', v_invalid_service USING ERRCODE = '22000';
    END IF;
  END IF;

  -- 1) Create board
  INSERT INTO public.boards (team_id, name, description, created_by, is_default, monthly_demand_limit)
  VALUES (p_team_id, v_trim_name, nullif(trim(p_description), ''), v_user_id, false, 0)
  RETURNING * INTO v_new_board;

  -- 2) Members in a single statement: creator (admin) + team admins (moderator) + provided members
  WITH base AS (
    SELECT v_user_id AS user_id, 'admin'::team_role AS role, 1 AS prio
    UNION ALL
    SELECT tm.user_id, 'moderator'::team_role, 2
    FROM public.team_members tm
    WHERE tm.team_id = p_team_id AND tm.role = 'admin' AND tm.user_id <> v_user_id
    UNION ALL
    SELECT (m->>'user_id')::uuid,
           COALESCE(NULLIF(m->>'role',''), 'executor')::team_role,
           3
    FROM jsonb_array_elements(COALESCE(p_members, '[]'::jsonb)) m
    WHERE EXISTS (
      SELECT 1 FROM public.team_members tm2
      WHERE tm2.team_id = p_team_id AND tm2.user_id = (m->>'user_id')::uuid
    )
  ),
  ranked AS (
    SELECT user_id, role,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY prio) AS rn
    FROM base
  )
  INSERT INTO public.board_members (board_id, user_id, role, added_by)
  SELECT v_new_board.id, user_id, role, v_user_id
  FROM ranked
  WHERE rn = 1
  ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  -- 3) Stages: insert all demand_statuses in one statement, capture ids in order
  WITH stages_in AS (
    SELECT
      ord - 1 AS pos,
      trim(s.value->>'name') AS name,
      COALESCE(NULLIF(s.value->>'color',''), '#6B7280') AS color,
      COALESCE(NULLIF(s.value->>'adjustment_type',''), 'none')::adjustment_type AS adj
    FROM jsonb_array_elements(v_stages) WITH ORDINALITY AS s(value, ord)
  ),
  inserted_status AS (
    INSERT INTO public.demand_statuses (name, color, board_id, is_system)
    SELECT name, color, v_new_board.id, true FROM stages_in ORDER BY pos
    RETURNING id, name
  ),
  -- Re-pair by name (insertion order preserved, but we map by name+pos to be safe)
  pairs AS (
    SELECT si.pos, si.adj,
           (SELECT i.id FROM inserted_status i WHERE i.name = si.name LIMIT 1) AS status_id
    FROM stages_in si
  )
  INSERT INTO public.board_statuses (board_id, status_id, position, is_active, adjustment_type)
  SELECT v_new_board.id, status_id, pos, true, adj
  FROM pairs
  WHERE status_id IS NOT NULL;

  -- Ensure "Entregue" exists
  IF NOT EXISTS (
    SELECT 1 FROM public.demand_statuses
    WHERE board_id = v_new_board.id AND lower(name) = 'entregue'
  ) THEN
    WITH ins AS (
      INSERT INTO public.demand_statuses (name, color, board_id, is_system)
      VALUES ('Entregue', '#10B981', v_new_board.id, true)
      RETURNING id
    )
    INSERT INTO public.board_statuses (board_id, status_id, position, is_active, adjustment_type)
    SELECT v_new_board.id, ins.id,
           COALESCE((SELECT MAX(position) + 1 FROM public.board_statuses WHERE board_id = v_new_board.id), 0),
           true, 'none'::adjustment_type
    FROM ins;
  END IF;

  -- 4) Services in a single statement
  IF p_services IS NOT NULL AND jsonb_typeof(p_services) = 'array' AND jsonb_array_length(p_services) > 0 THEN
    INSERT INTO public.board_services (board_id, service_id, monthly_limit)
    SELECT v_new_board.id,
           (s->>'service_id')::uuid,
           COALESCE((s->>'monthly_limit')::int, 0)
    FROM jsonb_array_elements(p_services) s
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_new_board;
END;
$function$;