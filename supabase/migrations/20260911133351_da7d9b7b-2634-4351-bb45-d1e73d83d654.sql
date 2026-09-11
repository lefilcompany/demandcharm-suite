GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;
REVOKE SELECT ON TABLE public.profiles FROM anon;
GRANT SELECT (id, full_name, avatar_url, job_title, bio, banner_url, banner_gradient) ON TABLE public.profiles TO anon;

GRANT EXECUTE ON FUNCTION public.is_board_member(uuid, uuid) TO authenticated, service_role, authenticator;
GRANT EXECUTE ON FUNCTION public.is_team_admin_or_moderator_for_board(uuid, uuid) TO authenticated, service_role, authenticator;
GRANT EXECUTE ON FUNCTION public.is_demand_shared(uuid) TO anon, authenticated, service_role, authenticator;
GRANT EXECUTE ON FUNCTION public.is_note_shared(uuid) TO anon, authenticated, service_role, authenticator;

CREATE OR REPLACE FUNCTION public.create_demand_assignee_notification(
  p_user_id uuid,
  p_demand_id uuid,
  p_title text,
  p_message text,
  p_type text,
  p_link text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_notification_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória';
  END IF;

  IF p_user_id IS NULL OR p_demand_id IS NULL THEN
    RAISE EXCEPTION 'Destinatário e demanda são obrigatórios';
  END IF;

  IF NOT public.can_manage_demand_assignees(v_actor, p_demand_id) THEN
    RAISE EXCEPTION 'Sem permissão para notificar responsáveis desta demanda';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.demands d
    WHERE d.id = p_demand_id
      AND (
        d.created_by = p_user_id
        OR EXISTS (
          SELECT 1 FROM public.board_members bm
          WHERE bm.board_id = d.board_id AND bm.user_id = p_user_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'Destinatário não pertence ao quadro da demanda';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    p_user_id,
    left(coalesce(nullif(trim(p_title), ''), 'Atualização de demanda'), 500),
    left(coalesce(nullif(trim(p_message), ''), 'Uma demanda foi atualizada.'), 5000),
    CASE WHEN p_type IN ('info', 'success', 'warning', 'error') THEN p_type ELSE 'info' END,
    p_link
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_demand_assignee_notification(uuid, uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_demand_assignee_notification(uuid, uuid, text, text, text, text) TO authenticated, service_role;