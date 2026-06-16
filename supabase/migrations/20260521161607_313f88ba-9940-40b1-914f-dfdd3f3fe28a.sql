
-- Add auto_join_board flag to share tokens
ALTER TABLE public.demand_share_tokens 
ADD COLUMN IF NOT EXISTS auto_join_board boolean NOT NULL DEFAULT false;

-- RPC: join the demand's board via share token as 'executor' (Agente)
CREATE OR REPLACE FUNCTION public.join_board_via_share_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_token RECORD;
  v_demand RECORD;
  v_is_team_member boolean;
  v_already_member boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  SELECT id, demand_id, is_active, expires_at, auto_join_board, created_by
  INTO v_token
  FROM public.demand_share_tokens
  WHERE token = p_token;

  IF v_token IS NULL OR NOT v_token.is_active THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_token');
  END IF;

  IF v_token.expires_at IS NOT NULL AND v_token.expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_token');
  END IF;

  IF NOT v_token.auto_join_board THEN
    RETURN jsonb_build_object('success', false, 'reason', 'auto_join_disabled');
  END IF;

  SELECT id, board_id, team_id INTO v_demand
  FROM public.demands WHERE id = v_token.demand_id;

  IF v_demand IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_token');
  END IF;

  -- Already a board member?
  SELECT EXISTS(
    SELECT 1 FROM public.board_members
    WHERE board_id = v_demand.board_id AND user_id = v_user_id
  ) INTO v_already_member;

  IF v_already_member THEN
    RETURN jsonb_build_object(
      'success', true, 'reason', 'already_member',
      'demand_id', v_demand.id, 'board_id', v_demand.board_id
    );
  END IF;

  -- Must belong to the team
  SELECT EXISTS(
    SELECT 1 FROM public.team_members
    WHERE team_id = v_demand.team_id AND user_id = v_user_id
  ) INTO v_is_team_member;

  IF NOT v_is_team_member THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_team_member');
  END IF;

  INSERT INTO public.board_members (board_id, user_id, role, added_by)
  VALUES (v_demand.board_id, v_user_id, 'executor'::team_role, v_token.created_by)
  ON CONFLICT (board_id, user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true, 'reason', 'joined',
    'demand_id', v_demand.id, 'board_id', v_demand.board_id
  );
END;
$$;
