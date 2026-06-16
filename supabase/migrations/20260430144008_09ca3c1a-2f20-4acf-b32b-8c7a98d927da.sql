CREATE OR REPLACE FUNCTION public.create_approval_notifications(
  p_demand_id uuid,
  p_recipient_ids uuid[],
  p_title text,
  p_message text,
  p_link text DEFAULT NULL,
  p_type text DEFAULT 'info'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_board_id uuid;
  v_inserted integer := 0;
  v_recipient uuid;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_demand_id IS NULL THEN
    RAISE EXCEPTION 'p_demand_id is required';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'p_title is required';
  END IF;

  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN
    RAISE EXCEPTION 'p_message is required';
  END IF;

  -- Resolve board for permission check
  SELECT board_id INTO v_board_id FROM public.demands WHERE id = p_demand_id;
  IF v_board_id IS NULL THEN
    RAISE EXCEPTION 'Demand or board not found';
  END IF;

  -- Actor must be member of the board
  IF NOT public.is_board_member(v_actor, v_board_id) THEN
    RAISE EXCEPTION 'Permission denied: actor is not a board member';
  END IF;

  IF p_recipient_ids IS NULL OR array_length(p_recipient_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Insert one notification per recipient that is a member of the board
  FOREACH v_recipient IN ARRAY p_recipient_ids LOOP
    IF v_recipient IS NULL OR v_recipient = v_actor THEN
      CONTINUE;
    END IF;

    IF NOT public.is_board_member(v_recipient, v_board_id) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (v_recipient, p_title, p_message, COALESCE(p_type, 'info'), p_link);

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$$;