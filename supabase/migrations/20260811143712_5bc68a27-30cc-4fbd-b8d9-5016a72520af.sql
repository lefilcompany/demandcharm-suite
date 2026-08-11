CREATE OR REPLACE FUNCTION public.duplicate_demand(
  p_demand_id uuid,
  p_new_due_date timestamptz DEFAULT NULL,
  p_subdemand_due_dates jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_src public.demands%ROWTYPE;
  v_new_id uuid;
  v_map jsonb := '{}'::jsonb;
  v_sub public.demands%ROWTYPE;
  v_sub_new_id uuid;
  v_due timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_src FROM public.demands WHERE id = p_demand_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demanda não encontrada';
  END IF;

  IF NOT public.is_board_member(v_user, v_src.board_id) THEN
    RAISE EXCEPTION 'Sem permissão para duplicar demandas neste quadro';
  END IF;

  INSERT INTO public.demands (
    title, description, team_id, board_id, status_id, priority,
    due_date, assigned_to, created_by, service_id, meet_link, parent_demand_id
  ) VALUES (
    '[CÓPIA] ' || v_src.title, v_src.description, v_src.team_id, v_src.board_id,
    v_src.status_id, v_src.priority,
    COALESCE(p_new_due_date, v_src.due_date), v_src.assigned_to, v_user,
    v_src.service_id, v_src.meet_link, NULL
  ) RETURNING id INTO v_new_id;

  v_map := jsonb_build_object(p_demand_id::text, v_new_id::text);

  INSERT INTO public.demand_assignees (demand_id, user_id, is_primary)
  SELECT v_new_id, user_id, is_primary FROM public.demand_assignees WHERE demand_id = p_demand_id;

  INSERT INTO public.demand_subtasks (demand_id, title, completed, sort_order)
  SELECT v_new_id, title, false, sort_order FROM public.demand_subtasks WHERE demand_id = p_demand_id;

  FOR v_sub IN
    SELECT * FROM public.demands
    WHERE parent_demand_id = p_demand_id AND archived = false
    ORDER BY subdemand_sort_order NULLS LAST, created_at
  LOOP
    v_due := v_sub.due_date;
    IF p_subdemand_due_dates ? v_sub.id::text THEN
      v_due := (p_subdemand_due_dates ->> v_sub.id::text)::timestamptz;
    END IF;

    INSERT INTO public.demands (
      title, description, team_id, board_id, status_id, priority,
      due_date, assigned_to, created_by, service_id, meet_link,
      parent_demand_id, subdemand_sort_order
    ) VALUES (
      v_sub.title, v_sub.description, v_sub.team_id, v_sub.board_id,
      v_sub.status_id, v_sub.priority, v_due, v_sub.assigned_to, v_user,
      v_sub.service_id, v_sub.meet_link, v_new_id, v_sub.subdemand_sort_order
    ) RETURNING id INTO v_sub_new_id;

    v_map := v_map || jsonb_build_object(v_sub.id::text, v_sub_new_id::text);

    INSERT INTO public.demand_assignees (demand_id, user_id, is_primary)
    SELECT v_sub_new_id, user_id, is_primary FROM public.demand_assignees WHERE demand_id = v_sub.id;

    INSERT INTO public.demand_subtasks (demand_id, title, completed, sort_order)
    SELECT v_sub_new_id, title, false, sort_order FROM public.demand_subtasks WHERE demand_id = v_sub.id;
  END LOOP;

  INSERT INTO public.demand_dependencies (demand_id, depends_on_demand_id)
  SELECT
    (v_map ->> d.demand_id::text)::uuid,
    COALESCE((v_map ->> d.depends_on_demand_id::text)::uuid, d.depends_on_demand_id)
  FROM public.demand_dependencies d
  WHERE v_map ? d.demand_id::text
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('new_demand_id', v_new_id, 'id_map', v_map);
END;
$$;

REVOKE ALL ON FUNCTION public.duplicate_demand(uuid, timestamptz, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_demand(uuid, timestamptz, jsonb) TO authenticated;