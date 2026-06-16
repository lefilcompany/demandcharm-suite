-- Função SECURITY DEFINER para criar notificações de mudança de membro de quadro.
-- Valida que o ator (auth.uid()) é admin/moderator do quadro ou admin/moderator da equipe do quadro.
CREATE OR REPLACE FUNCTION public.create_board_membership_notification(
  p_user_id uuid,
  p_board_id uuid,
  p_title text,
  p_message text,
  p_type text DEFAULT 'info',
  p_link text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid;
  v_notification_id uuid;
  v_allowed boolean;
BEGIN
  v_actor := auth.uid();

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id IS NULL OR p_board_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id and p_board_id are required';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'p_title is required';
  END IF;

  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN
    RAISE EXCEPTION 'p_message is required';
  END IF;

  -- Validate actor permission: must be admin/moderator of the board OR team admin/moderator for the board
  SELECT (
    public.is_board_admin_or_moderator(v_actor, p_board_id)
    OR public.is_team_admin_or_moderator_for_board(v_actor, p_board_id)
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Permission denied to create board membership notification';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (p_user_id, p_title, p_message, COALESCE(p_type, 'info'), p_link)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;