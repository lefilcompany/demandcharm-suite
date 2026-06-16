CREATE OR REPLACE FUNCTION public.propagate_status_to_subdemands(
  p_parent_id uuid,
  p_new_status_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_parent RECORD;
  v_delivered_status_id uuid;
  v_subdemand RECORD;
  v_active_entry RECORD;
  v_updated_count integer := 0;
  v_stopped_timers integer := 0;
  v_now timestamptz := now();
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_parent_id IS NULL OR p_new_status_id IS NULL THEN
    RAISE EXCEPTION 'p_parent_id and p_new_status_id are required';
  END IF;

  -- Load parent demand
  SELECT id, board_id, parent_demand_id, team_id
  INTO v_parent
  FROM public.demands
  WHERE id = p_parent_id;

  IF v_parent IS NULL THEN
    RAISE EXCEPTION 'Parent demand not found';
  END IF;

  -- Validate that user is a board member
  IF NOT public.is_board_member(v_user_id, v_parent.board_id) THEN
    RAISE EXCEPTION 'Permission denied: not a board member';
  END IF;

  -- Resolve the "Entregue" status id (system-wide status, no board_id)
  SELECT id INTO v_delivered_status_id
  FROM public.demand_statuses
  WHERE name = 'Entregue'
  LIMIT 1;

  -- Loop through active subdemands and propagate status
  FOR v_subdemand IN
    SELECT id, status_id, last_started_at, time_in_progress_seconds
    FROM public.demands
    WHERE parent_demand_id = p_parent_id
      AND archived = false
      AND status_id <> p_new_status_id
  LOOP
    -- 1) Stop any active time entry for this subdemand (across all users)
    FOR v_active_entry IN
      SELECT id, started_at
      FROM public.demand_time_entries
      WHERE demand_id = v_subdemand.id
        AND ended_at IS NULL
    LOOP
      UPDATE public.demand_time_entries
      SET ended_at = v_now,
          duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_active_entry.started_at))::integer)
      WHERE id = v_active_entry.id;
      v_stopped_timers := v_stopped_timers + 1;
    END LOOP;

    -- 2) Update the subdemand status. The existing trigger update_time_in_progress
    --    handles last_started_at + time_in_progress_seconds when leaving Fazendo/Em Ajuste.
    --    The trigger set_demand_delivered_at handles delivered_at.
    UPDATE public.demands
    SET status_id = p_new_status_id,
        status_changed_by = v_user_id,
        status_changed_at = v_now
    WHERE id = v_subdemand.id;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'updated_count', v_updated_count,
    'stopped_timers', v_stopped_timers
  );
END;
$$;