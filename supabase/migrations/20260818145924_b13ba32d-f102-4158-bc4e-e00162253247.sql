CREATE OR REPLACE FUNCTION public.reorder_subdemands(p_parent_id uuid, p_ordered_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_parent RECORD;
  v_role team_role;
  v_can_edit BOOLEAN;
  v_id UUID;
  v_idx INTEGER := 1;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, board_id, team_id, created_by INTO v_parent
  FROM public.demands WHERE id = p_parent_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parent demand not found'; END IF;

  v_role := public.get_board_role(v_user_id, v_parent.board_id);

  v_can_edit := (
    v_role IN ('admin', 'moderator', 'executor')
    OR public.is_team_admin_or_moderator(v_user_id, v_parent.team_id)
    OR v_parent.created_by = v_user_id
    OR EXISTS (SELECT 1 FROM public.demand_assignees WHERE demand_id = p_parent_id AND user_id = v_user_id)
    OR EXISTS (
      SELECT 1 FROM public.demand_assignees da
      JOIN public.demands d ON d.id = da.demand_id
      WHERE d.parent_demand_id = p_parent_id AND da.user_id = v_user_id
    )
  );

  IF NOT v_can_edit THEN RAISE EXCEPTION 'Permission denied to reorder subdemands'; END IF;

  FOREACH v_id IN ARRAY p_ordered_ids LOOP
    UPDATE public.demands SET subdemand_sort_order = v_idx
    WHERE id = v_id AND parent_demand_id = p_parent_id;
    v_idx := v_idx + 1;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.reorder_subdemands(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_subdemands(uuid, uuid[]) TO authenticated, service_role;