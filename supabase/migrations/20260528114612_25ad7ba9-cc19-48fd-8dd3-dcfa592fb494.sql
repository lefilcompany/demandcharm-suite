
-- Helper: get the active plan for a team (active or trialing-not-expired), fallback to Starter
CREATE OR REPLACE FUNCTION public.get_team_active_plan(_team_id uuid)
RETURNS public.plans
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan public.plans;
BEGIN
  SELECT p.* INTO v_plan
  FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.team_id = _team_id
    AND (
      s.status = 'active'
      OR (s.status = 'trialing' AND (s.trial_ends_at IS NULL OR s.trial_ends_at > now()))
    )
  ORDER BY
    CASE WHEN s.status = 'active' THEN 0 ELSE 1 END,
    s.updated_at DESC
  LIMIT 1;

  IF v_plan IS NULL THEN
    SELECT * INTO v_plan FROM public.plans WHERE slug = 'starter' AND is_active = true LIMIT 1;
  END IF;

  RETURN v_plan;
END;
$$;

-- =========================================================
-- BOARDS LIMIT
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_board_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan public.plans;
  v_count integer;
BEGIN
  v_plan := public.get_team_active_plan(NEW.team_id);
  IF v_plan IS NULL OR v_plan.max_boards = -1 THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count FROM public.boards WHERE team_id = NEW.team_id;

  IF v_count >= v_plan.max_boards THEN
    RAISE EXCEPTION 'PLAN_LIMIT_BOARDS: O plano % permite até % quadro(s). Faça upgrade para criar mais.', v_plan.name, v_plan.max_boards
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_board_limit ON public.boards;
CREATE TRIGGER trg_enforce_board_limit
BEFORE INSERT ON public.boards
FOR EACH ROW EXECUTE FUNCTION public.enforce_board_limit();

-- =========================================================
-- TEAM MEMBERS LIMIT
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_team_member_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan public.plans;
  v_count integer;
BEGIN
  v_plan := public.get_team_active_plan(NEW.team_id);
  IF v_plan IS NULL OR v_plan.max_members = -1 THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count FROM public.team_members WHERE team_id = NEW.team_id;

  IF v_count >= v_plan.max_members THEN
    RAISE EXCEPTION 'PLAN_LIMIT_MEMBERS: O plano % permite até % membro(s) por equipe. Faça upgrade para adicionar mais.', v_plan.name, v_plan.max_members
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_team_member_limit ON public.team_members;
CREATE TRIGGER trg_enforce_team_member_limit
BEFORE INSERT ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_team_member_limit();

-- =========================================================
-- DEMANDS MONTHLY LIMIT
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_demand_monthly_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan public.plans;
  v_count integer;
BEGIN
  IF NEW.team_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_plan := public.get_team_active_plan(NEW.team_id);
  IF v_plan IS NULL OR v_plan.max_demands_per_month = -1 THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.demands
  WHERE team_id = NEW.team_id
    AND archived = false
    AND created_at >= date_trunc('month', now())
    AND created_at <  date_trunc('month', now()) + interval '1 month';

  IF v_count >= v_plan.max_demands_per_month THEN
    RAISE EXCEPTION 'PLAN_LIMIT_DEMANDS: O plano % permite até % demanda(s) por mês. Faça upgrade para criar mais.', v_plan.name, v_plan.max_demands_per_month
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_demand_monthly_limit ON public.demands;
CREATE TRIGGER trg_enforce_demand_monthly_limit
BEFORE INSERT ON public.demands
FOR EACH ROW EXECUTE FUNCTION public.enforce_demand_monthly_limit();

-- =========================================================
-- SERVICES LIMIT
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_service_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan public.plans;
  v_count integer;
BEGIN
  IF NEW.team_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_plan := public.get_team_active_plan(NEW.team_id);
  IF v_plan IS NULL OR v_plan.max_services = -1 THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count FROM public.services WHERE team_id = NEW.team_id;

  IF v_count >= v_plan.max_services THEN
    RAISE EXCEPTION 'PLAN_LIMIT_SERVICES: O plano % permite até % serviço(s). Faça upgrade para cadastrar mais.', v_plan.name, v_plan.max_services
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_service_limit ON public.services;
CREATE TRIGGER trg_enforce_service_limit
BEFORE INSERT ON public.services
FOR EACH ROW EXECUTE FUNCTION public.enforce_service_limit();

-- =========================================================
-- NOTES LIMIT
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_note_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan public.plans;
  v_count integer;
BEGIN
  IF NEW.team_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_plan := public.get_team_active_plan(NEW.team_id);
  IF v_plan IS NULL OR v_plan.max_notes = -1 THEN
    RETURN NEW;
  END IF;

  IF v_plan.max_notes = 0 THEN
    RAISE EXCEPTION 'PLAN_LIMIT_NOTES: O plano % não inclui notas. Faça upgrade para usar este recurso.', v_plan.name
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_count FROM public.notes WHERE team_id = NEW.team_id AND archived = false;

  IF v_count >= v_plan.max_notes THEN
    RAISE EXCEPTION 'PLAN_LIMIT_NOTES: O plano % permite até % nota(s). Faça upgrade para criar mais.', v_plan.name, v_plan.max_notes
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_note_limit ON public.notes;
CREATE TRIGGER trg_enforce_note_limit
BEFORE INSERT ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.enforce_note_limit();
