
CREATE OR REPLACE FUNCTION public.check_plan_limit(_team_id uuid, _resource text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan public.plans;
  v_limit integer;
  v_used integer;
  v_msg text;
BEGIN
  v_plan := public.get_team_active_plan(_team_id);
  IF v_plan IS NULL THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  CASE _resource
    WHEN 'boards' THEN
      v_limit := v_plan.max_boards;
      IF v_limit = -1 THEN RETURN jsonb_build_object('allowed', true, 'plan', v_plan.name); END IF;
      SELECT count(*) INTO v_used FROM public.boards WHERE team_id = _team_id;
      v_msg := format('O plano %s permite até %s quadro(s). Faça upgrade para criar mais.', v_plan.name, v_limit);
    WHEN 'members' THEN
      v_limit := v_plan.max_members;
      IF v_limit = -1 THEN RETURN jsonb_build_object('allowed', true, 'plan', v_plan.name); END IF;
      SELECT count(*) INTO v_used FROM public.team_members WHERE team_id = _team_id;
      v_msg := format('O plano %s permite até %s membro(s) por equipe. Faça upgrade para adicionar mais.', v_plan.name, v_limit);
    WHEN 'demands' THEN
      v_limit := v_plan.max_demands_per_month;
      IF v_limit = -1 THEN RETURN jsonb_build_object('allowed', true, 'plan', v_plan.name); END IF;
      SELECT count(*) INTO v_used FROM public.demands
        WHERE team_id = _team_id AND archived = false
          AND created_at >= date_trunc('month', now())
          AND created_at <  date_trunc('month', now()) + interval '1 month';
      v_msg := format('O plano %s permite até %s demanda(s) por mês. Faça upgrade para criar mais.', v_plan.name, v_limit);
    WHEN 'services' THEN
      v_limit := v_plan.max_services;
      IF v_limit = -1 THEN RETURN jsonb_build_object('allowed', true, 'plan', v_plan.name); END IF;
      SELECT count(*) INTO v_used FROM public.services WHERE team_id = _team_id;
      v_msg := format('O plano %s permite até %s serviço(s). Faça upgrade para cadastrar mais.', v_plan.name, v_limit);
    WHEN 'notes' THEN
      v_limit := v_plan.max_notes;
      IF v_limit = -1 THEN RETURN jsonb_build_object('allowed', true, 'plan', v_plan.name); END IF;
      IF v_limit = 0 THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'plan', v_plan.name,
          'limit', 0,
          'used', 0,
          'message', format('O plano %s não inclui notas. Faça upgrade para usar este recurso.', v_plan.name)
        );
      END IF;
      SELECT count(*) INTO v_used FROM public.notes WHERE team_id = _team_id AND archived = false;
      v_msg := format('O plano %s permite até %s nota(s). Faça upgrade para criar mais.', v_plan.name, v_limit);
    ELSE
      RETURN jsonb_build_object('allowed', true);
  END CASE;

  RETURN jsonb_build_object(
    'allowed', v_used < v_limit,
    'plan', v_plan.name,
    'limit', v_limit,
    'used', v_used,
    'message', CASE WHEN v_used < v_limit THEN NULL ELSE v_msg END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_plan_limit(uuid, text) TO authenticated, anon, service_role;
