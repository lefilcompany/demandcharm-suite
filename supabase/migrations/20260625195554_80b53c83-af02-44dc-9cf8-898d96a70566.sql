CREATE OR REPLACE FUNCTION public.add_creator_to_board()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.board_members (board_id, user_id, role, added_by)
  VALUES (NEW.id, NEW.created_by, 'admin', NEW.created_by)
  ON CONFLICT (board_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_member_to_default_board()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role = 'admin' THEN
    INSERT INTO public.board_members (board_id, user_id, role, added_by)
    SELECT b.id, NEW.user_id, 'moderator'::team_role, NEW.user_id
    FROM public.boards b WHERE b.team_id = NEW.team_id
    ON CONFLICT (board_id, user_id) DO UPDATE SET role = 'moderator'::team_role;
  ELSE
    INSERT INTO public.board_members (board_id, user_id, role, added_by)
    SELECT b.id, NEW.user_id, 'requester'::team_role, NEW.user_id
    FROM public.boards b WHERE b.team_id = NEW.team_id AND b.is_default = true
    ON CONFLICT (board_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_create_demand(_team_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN (SELECT monthly_demand_limit FROM public.teams WHERE id = _team_id) = 0 THEN true
    ELSE (
      SELECT COUNT(*) < (SELECT monthly_demand_limit FROM public.teams WHERE id = _team_id)
      FROM public.demands
      WHERE team_id = _team_id
        AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
        AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
        AND archived = false
    )
  END
$function$;

CREATE OR REPLACE FUNCTION public.can_create_demand_with_service(_board_id uuid, _service_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN NOT EXISTS (SELECT 1 FROM public.board_services WHERE board_id = _board_id) THEN true
    WHEN NOT EXISTS (SELECT 1 FROM public.board_services WHERE board_id = _board_id AND service_id = _service_id) THEN false
    WHEN (SELECT monthly_limit FROM public.board_services WHERE board_id = _board_id AND service_id = _service_id) = 0 THEN true
    ELSE (
      SELECT COUNT(*) < (SELECT monthly_limit FROM public.board_services WHERE board_id = _board_id AND service_id = _service_id)
      FROM public.demands
      WHERE board_id = _board_id AND service_id = _service_id
        AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
        AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
        AND archived = false
    )
  END
$function$;

CREATE OR REPLACE FUNCTION public.can_edit_note(_note_id uuid, _user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.notes WHERE id = _note_id AND created_by = _user_id)
  OR EXISTS (SELECT 1 FROM public.note_shares WHERE note_id = _note_id AND shared_with_user_id = _user_id AND permission = 'editor');
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_demand_assignees(_user_id uuid, _demand_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.demands d
    LEFT JOIN public.board_members bm ON bm.board_id = d.board_id AND bm.user_id = _user_id
    WHERE d.id = _demand_id
      AND (d.created_by = _user_id OR bm.role IN ('admin','moderator','executor')
        OR EXISTS (SELECT 1 FROM public.demand_assignees da WHERE da.demand_id = _demand_id AND da.user_id = _user_id))
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_view_demand_channel(_user_id uuid, _demand_id uuid, _channel text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _channel = 'general' THEN true
    WHEN _channel = 'internal' THEN EXISTS (
      SELECT 1 FROM public.demands d
      JOIN public.board_members bm ON bm.board_id = d.board_id AND bm.user_id = _user_id
      WHERE d.id = _demand_id AND bm.role IN ('admin','moderator','executor'))
    ELSE false
  END
$function$;

CREATE OR REPLACE FUNCTION public.check_access_code_exists(code text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (SELECT 1 FROM teams WHERE access_code = upper(code));
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_team_active_plan(_team_id uuid)
 RETURNS plans LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_plan public.plans;
BEGIN
  SELECT p.* INTO v_plan FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.team_id = _team_id
    AND (s.status = 'active' OR (s.status = 'trialing' AND (s.trial_ends_at IS NULL OR s.trial_ends_at > now())))
  ORDER BY CASE WHEN s.status = 'active' THEN 0 ELSE 1 END, s.updated_at DESC
  LIMIT 1;
  IF v_plan IS NULL THEN
    SELECT * INTO v_plan FROM public.plans WHERE slug = 'starter' AND is_active = true LIMIT 1;
  END IF;
  RETURN v_plan;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_plan_limit(_team_id uuid, _resource text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_plan public.plans; v_limit integer; v_used integer; v_msg text;
BEGIN
  v_plan := public.get_team_active_plan(_team_id);
  IF v_plan IS NULL THEN RETURN jsonb_build_object('allowed', true); END IF;
  CASE _resource
    WHEN 'boards' THEN v_limit := v_plan.max_boards;
      IF v_limit = -1 THEN RETURN jsonb_build_object('allowed', true, 'plan', v_plan.name); END IF;
      SELECT count(*) INTO v_used FROM public.boards WHERE team_id = _team_id;
      v_msg := format('O plano %s permite até %s quadro(s). Faça upgrade para criar mais.', v_plan.name, v_limit);
    WHEN 'members' THEN v_limit := v_plan.max_members;
      IF v_limit = -1 THEN RETURN jsonb_build_object('allowed', true, 'plan', v_plan.name); END IF;
      SELECT count(*) INTO v_used FROM public.team_members WHERE team_id = _team_id;
      v_msg := format('O plano %s permite até %s membro(s) por equipe. Faça upgrade para adicionar mais.', v_plan.name, v_limit);
    WHEN 'demands' THEN v_limit := v_plan.max_demands_per_month;
      IF v_limit = -1 THEN RETURN jsonb_build_object('allowed', true, 'plan', v_plan.name); END IF;
      SELECT count(*) INTO v_used FROM public.demands
        WHERE team_id = _team_id AND archived = false
          AND created_at >= date_trunc('month', now())
          AND created_at <  date_trunc('month', now()) + interval '1 month';
      v_msg := format('O plano %s permite até %s demanda(s) por mês. Faça upgrade para criar mais.', v_plan.name, v_limit);
    WHEN 'services' THEN v_limit := v_plan.max_services;
      IF v_limit = -1 THEN RETURN jsonb_build_object('allowed', true, 'plan', v_plan.name); END IF;
      SELECT count(*) INTO v_used FROM public.services WHERE team_id = _team_id;
      v_msg := format('O plano %s permite até %s serviço(s). Faça upgrade para cadastrar mais.', v_plan.name, v_limit);
    WHEN 'notes' THEN v_limit := v_plan.max_notes;
      IF v_limit = -1 THEN RETURN jsonb_build_object('allowed', true, 'plan', v_plan.name); END IF;
      IF v_limit = 0 THEN RETURN jsonb_build_object('allowed', false, 'plan', v_plan.name, 'limit', 0, 'used', 0, 'message', format('O plano %s não inclui notas. Faça upgrade para usar este recurso.', v_plan.name)); END IF;
      SELECT count(*) INTO v_used FROM public.notes WHERE team_id = _team_id AND archived = false;
      v_msg := format('O plano %s permite até %s nota(s). Faça upgrade para criar mais.', v_plan.name, v_limit);
    ELSE RETURN jsonb_build_object('allowed', true);
  END CASE;
  RETURN jsonb_build_object('allowed', v_used < v_limit, 'plan', v_plan.name, 'limit', v_limit, 'used', v_used, 'message', CASE WHEN v_used < v_limit THEN NULL ELSE v_msg END);
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_subscription_limit(_team_id uuid, _resource_type text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _plan_limit INTEGER; _current_usage INTEGER; _plan_record RECORD;
BEGIN
  SELECT p.* INTO _plan_record FROM public.subscriptions s JOIN public.plans p ON s.plan_id = p.id WHERE s.team_id = _team_id AND s.status = 'active';
  IF _plan_record IS NULL THEN SELECT * INTO _plan_record FROM public.plans WHERE slug = 'starter'; END IF;
  CASE _resource_type
    WHEN 'demands' THEN _plan_limit := _plan_record.max_demands_per_month;
      SELECT COALESCE(demands_created, 0) INTO _current_usage FROM public.usage_records WHERE team_id = _team_id AND period_start = date_trunc('month', now());
    WHEN 'boards' THEN _plan_limit := _plan_record.max_boards;
      SELECT COUNT(*) INTO _current_usage FROM public.boards WHERE team_id = _team_id;
    WHEN 'members' THEN _plan_limit := _plan_record.max_members;
      SELECT COUNT(*) INTO _current_usage FROM public.team_members WHERE team_id = _team_id;
    ELSE RETURN true;
  END CASE;
  IF _plan_limit = -1 THEN RETURN true; END IF;
  RETURN COALESCE(_current_usage, 0) < _plan_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.compute_demand_is_overdue()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_delivered_status_id uuid; v_effective_delivered_at timestamptz;
BEGIN
  IF NEW.due_date IS NULL THEN NEW.is_overdue := false; RETURN NEW; END IF;
  SELECT id INTO v_delivered_status_id FROM public.demand_statuses WHERE name = 'Entregue' LIMIT 1;
  IF NEW.status_id = v_delivered_status_id THEN
    v_effective_delivered_at := COALESCE(NEW.delivered_at, now());
    IF v_effective_delivered_at > NEW.due_date THEN NEW.is_overdue := true; ELSE NEW.is_overdue := false; END IF;
  ELSE
    IF NEW.due_date < now() THEN NEW.is_overdue := true; ELSE NEW.is_overdue := false; END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_board_member(_user_id uuid, _board_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.board_members WHERE user_id = _user_id AND board_id = _board_id)
$function$;

CREATE OR REPLACE FUNCTION public.is_board_admin_or_moderator(_user_id uuid, _board_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.board_members WHERE board_id = _board_id AND user_id = _user_id AND role IN ('admin','moderator'))
$function$;

CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id)
$function$;

CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id uuid, _team_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id AND role = 'admin')
$function$;

CREATE OR REPLACE FUNCTION public.is_team_owner(_user_id uuid, _team_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id AND role = 'admin')
$function$;

CREATE OR REPLACE FUNCTION public.is_team_admin_or_moderator(_user_id uuid, _team_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id AND role IN ('admin','moderator'))
$function$;

CREATE OR REPLACE FUNCTION public.is_team_admin_or_moderator_for_board(_user_id uuid, _board_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.boards b
    JOIN public.team_members tm ON tm.team_id = b.team_id
    WHERE b.id = _board_id AND tm.user_id = _user_id AND tm.role IN ('admin','moderator')
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_board_admin_in_team(_user_id uuid, _team_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.board_members bm
    JOIN public.boards b ON b.id = bm.board_id
    WHERE bm.user_id = _user_id AND b.team_id = _team_id AND bm.role IN ('admin','moderator')
  )
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$function$;

CREATE OR REPLACE FUNCTION public.has_team_role(_user_id uuid, _team_id uuid, _role team_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id AND role = _role)
$function$;

CREATE OR REPLACE FUNCTION public.has_board_role(_user_id uuid, _board_id uuid, _role team_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.board_members WHERE user_id = _user_id AND board_id = _board_id AND role = _role)
$function$;

CREATE OR REPLACE FUNCTION public.get_user_team_ids(_user_id uuid)
 RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT team_id FROM public.team_members WHERE user_id = _user_id $function$;

CREATE OR REPLACE FUNCTION public.get_user_board_ids(_user_id uuid)
 RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT board_id FROM public.board_members WHERE user_id = _user_id $function$;

CREATE OR REPLACE FUNCTION public.get_board_role(_user_id uuid, _board_id uuid)
 RETURNS team_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT role FROM public.board_members WHERE user_id = _user_id AND board_id = _board_id $function$;

CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND created_by = _user_id)
    OR EXISTS (SELECT 1 FROM public.project_shares WHERE project_id = _project_id AND user_id = _user_id)
$function$;

CREATE OR REPLACE FUNCTION public.has_project_edit_access(_user_id uuid, _project_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND created_by = _user_id)
    OR EXISTS (SELECT 1 FROM public.project_shares WHERE project_id = _project_id AND user_id = _user_id AND permission = 'edit')
$function$;

CREATE OR REPLACE FUNCTION public.has_folder_access(_user_id uuid, _folder_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT public.has_project_access(_user_id, _folder_id) $function$;

CREATE OR REPLACE FUNCTION public.has_folder_edit_access(_user_id uuid, _folder_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT public.has_project_edit_access(_user_id, _folder_id) $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, phone, state, city, email)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário'),
    new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'state', new.raw_user_meta_data->>'city', new.email);
  IF lower(coalesce(new.email, '')) = 'systemsoma@lefil.com.br' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'member');
  END IF;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.create_trial_subscription_for_team()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_plan_id uuid; v_trial_ends timestamptz;
BEGIN
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE team_id = NEW.id) THEN RETURN NEW; END IF;
  SELECT id INTO v_plan_id FROM public.plans WHERE slug = 'starter' AND is_active = true LIMIT 1;
  IF v_plan_id IS NULL THEN SELECT id INTO v_plan_id FROM public.plans WHERE is_active = true ORDER BY sort_order ASC LIMIT 1; END IF;
  IF v_plan_id IS NULL THEN RETURN NEW; END IF;
  v_trial_ends := now() + interval '3 days';
  INSERT INTO public.subscriptions (team_id, plan_id, status, current_period_start, current_period_end, trial_ends_at)
  VALUES (NEW.id, v_plan_id, 'trialing', now(), v_trial_ends, v_trial_ends);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_board_limit()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_plan public.plans; v_count integer;
BEGIN
  v_plan := public.get_team_active_plan(NEW.team_id);
  IF v_plan IS NULL OR v_plan.max_boards = -1 THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM public.boards WHERE team_id = NEW.team_id;
  IF v_count >= v_plan.max_boards THEN
    RAISE EXCEPTION 'PLAN_LIMIT_BOARDS: O plano % permite até % quadro(s). Faça upgrade para criar mais.', v_plan.name, v_plan.max_boards USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_demand_monthly_limit()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_plan public.plans; v_count integer;
BEGIN
  IF NEW.team_id IS NULL THEN RETURN NEW; END IF;
  v_plan := public.get_team_active_plan(NEW.team_id);
  IF v_plan IS NULL OR v_plan.max_demands_per_month = -1 THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM public.demands
  WHERE team_id = NEW.team_id AND archived = false
    AND created_at >= date_trunc('month', now())
    AND created_at <  date_trunc('month', now()) + interval '1 month';
  IF v_count >= v_plan.max_demands_per_month THEN
    RAISE EXCEPTION 'PLAN_LIMIT_DEMANDS: O plano % permite até % demanda(s) por mês. Faça upgrade para criar mais.', v_plan.name, v_plan.max_demands_per_month USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_note_limit()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_plan public.plans; v_count integer;
BEGIN
  IF NEW.team_id IS NULL THEN RETURN NEW; END IF;
  v_plan := public.get_team_active_plan(NEW.team_id);
  IF v_plan IS NULL OR v_plan.max_notes = -1 THEN RETURN NEW; END IF;
  IF v_plan.max_notes = 0 THEN
    RAISE EXCEPTION 'PLAN_LIMIT_NOTES: O plano % não inclui notas. Faça upgrade para usar este recurso.', v_plan.name USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO v_count FROM public.notes WHERE team_id = NEW.team_id AND archived = false;
  IF v_count >= v_plan.max_notes THEN
    RAISE EXCEPTION 'PLAN_LIMIT_NOTES: O plano % permite até % nota(s). Faça upgrade para criar mais.', v_plan.name, v_plan.max_notes USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_service_limit()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_plan public.plans; v_count integer;
BEGIN
  IF NEW.team_id IS NULL THEN RETURN NEW; END IF;
  v_plan := public.get_team_active_plan(NEW.team_id);
  IF v_plan IS NULL OR v_plan.max_services = -1 THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM public.services WHERE team_id = NEW.team_id;
  IF v_count >= v_plan.max_services THEN
    RAISE EXCEPTION 'PLAN_LIMIT_SERVICES: O plano % permite até % serviço(s). Faça upgrade para cadastrar mais.', v_plan.name, v_plan.max_services USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_team_member_limit()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_plan public.plans; v_count integer;
BEGIN
  v_plan := public.get_team_active_plan(NEW.team_id);
  IF v_plan IS NULL OR v_plan.max_members = -1 THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM public.team_members WHERE team_id = NEW.team_id;
  IF v_count >= v_plan.max_members THEN
    RAISE EXCEPTION 'PLAN_LIMIT_MEMBERS: O plano % permite até % membro(s) por equipe. Faça upgrade para adicionar mais.', v_plan.name, v_plan.max_members USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.email_exists(_email text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(trim(_email))); $function$;

CREATE OR REPLACE FUNCTION public.get_team_by_access_code(code text)
 RETURNS TABLE(id uuid, name text, description text, created_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT id, name, description, created_at FROM teams WHERE access_code = code; $function$;

CREATE OR REPLACE FUNCTION public.get_team_plan(_team_id uuid)
 RETURNS plans LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _plan public.plans;
BEGIN
  SELECT p.* INTO _plan FROM public.subscriptions s JOIN public.plans p ON s.plan_id = p.id WHERE s.team_id = _team_id AND s.status = 'active';
  IF _plan IS NULL THEN SELECT * INTO _plan FROM public.plans WHERE slug = 'starter'; END IF;
  RETURN _plan;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_board_service_demand_count(_board_id uuid, _service_id uuid)
 RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::INTEGER FROM public.demands
  WHERE board_id = _board_id AND service_id = _service_id
    AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
    AND archived = false
$function$;

CREATE OR REPLACE FUNCTION public.get_monthly_demand_count(_team_id uuid, _month integer, _year integer)
 RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::integer FROM public.demands
  WHERE team_id = _team_id AND EXTRACT(MONTH FROM created_at) = _month
    AND EXTRACT(YEAR FROM created_at) = _year AND archived = false
$function$;

CREATE OR REPLACE FUNCTION public.get_join_request_profiles(request_team_id uuid)
 RETURNS TABLE(id uuid, full_name text, avatar_url text, email text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.id, p.full_name, p.avatar_url, p.email FROM profiles p
  INNER JOIN team_join_requests tjr ON tjr.user_id = p.id
  WHERE tjr.team_id = request_team_id AND tjr.status = 'pending'
    AND is_team_owner(auth.uid(), request_team_id)
$function$;

CREATE OR REPLACE FUNCTION public.get_shared_board_summary(p_token text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb; v_token_record record;
BEGIN
  SELECT bsst.id, bsst.is_active, bsst.expires_at, bsst.summary_id INTO v_token_record
  FROM board_summary_share_tokens bsst WHERE bsst.token = p_token;
  IF v_token_record IS NULL OR NOT v_token_record.is_active THEN RETURN NULL; END IF;
  IF v_token_record.expires_at IS NOT NULL AND v_token_record.expires_at < now() THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('id', bsh.id, 'summary_text', bsh.summary_text, 'analytics_data', bsh.analytics_data,
    'created_at', bsh.created_at, 'board', jsonb_build_object('name', b.name))
  INTO v_result FROM board_summary_history bsh
  LEFT JOIN boards b ON b.id = bsh.board_id WHERE bsh.id = v_token_record.summary_id;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_approval_notifications(p_demand_id uuid, p_recipient_ids uuid[], p_title text, p_message text, p_link text DEFAULT NULL, p_type text DEFAULT 'info')
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor uuid; v_board_id uuid; v_inserted integer := 0; v_recipient uuid;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_demand_id IS NULL THEN RAISE EXCEPTION 'p_demand_id is required'; END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'p_title is required'; END IF;
  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN RAISE EXCEPTION 'p_message is required'; END IF;
  SELECT board_id INTO v_board_id FROM public.demands WHERE id = p_demand_id;
  IF v_board_id IS NULL THEN RAISE EXCEPTION 'Demand or board not found'; END IF;
  IF NOT public.is_board_member(v_actor, v_board_id) THEN RAISE EXCEPTION 'Permission denied: actor is not a board member'; END IF;
  IF p_recipient_ids IS NULL OR array_length(p_recipient_ids, 1) IS NULL THEN RETURN 0; END IF;
  FOREACH v_recipient IN ARRAY p_recipient_ids LOOP
    IF v_recipient IS NULL OR v_recipient = v_actor THEN CONTINUE; END IF;
    IF NOT public.is_board_member(v_recipient, v_board_id) THEN CONTINUE; END IF;
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (v_recipient, p_title, p_message, COALESCE(p_type, 'info'), p_link);
    v_inserted := v_inserted + 1;
  END LOOP;
  RETURN v_inserted;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_board_membership_notification(p_user_id uuid, p_board_id uuid, p_title text, p_message text, p_type text DEFAULT 'info', p_link text DEFAULT NULL)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor uuid; v_notification_id uuid; v_allowed boolean;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_user_id IS NULL OR p_board_id IS NULL THEN RAISE EXCEPTION 'p_user_id and p_board_id are required'; END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'p_title is required'; END IF;
  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN RAISE EXCEPTION 'p_message is required'; END IF;
  SELECT (public.is_board_admin_or_moderator(v_actor, p_board_id) OR public.is_team_admin_or_moderator_for_board(v_actor, p_board_id)) INTO v_allowed;
  IF NOT v_allowed THEN RAISE EXCEPTION 'Permission denied to create board membership notification'; END IF;
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (p_user_id, p_title, p_message, COALESCE(p_type, 'info'), p_link)
  RETURNING id INTO v_notification_id;
  RETURN v_notification_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_board_with_services(p_team_id uuid, p_name text, p_description text DEFAULT NULL, p_services jsonb DEFAULT '[]', p_stages jsonb DEFAULT NULL, p_members jsonb DEFAULT '[]')
 RETURNS boards LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_user_id UUID := auth.uid(); v_new_board public.boards; v_trim_name TEXT := trim(p_name); v_stages jsonb := p_stages; v_invalid_service UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'PGRST301'; END IF;
  IF NOT public.is_team_admin_or_moderator(v_user_id, p_team_id) THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501'; END IF;
  IF v_trim_name IS NULL OR v_trim_name = '' THEN RAISE EXCEPTION 'Board name is required' USING ERRCODE = '22000'; END IF;
  IF length(v_trim_name) > 100 THEN RAISE EXCEPTION 'Board name too long' USING ERRCODE = '22000'; END IF;
  IF EXISTS (SELECT 1 FROM public.boards WHERE team_id = p_team_id AND lower(trim(name)) = lower(v_trim_name)) THEN
    RAISE EXCEPTION 'A board with this name already exists' USING ERRCODE = '23505';
  END IF;
  IF v_stages IS NULL OR jsonb_typeof(v_stages) <> 'array' OR jsonb_array_length(v_stages) = 0 THEN
    v_stages := '[{"name":"A Iniciar","color":"#6B7280","adjustment_type":"none"},{"name":"Fazendo","color":"#3B82F6","adjustment_type":"none"},{"name":"Aprovação Interna","color":"#3B82F6","adjustment_type":"internal"},{"name":"Em Ajuste","color":"#9333EA","adjustment_type":"none"},{"name":"Entregue","color":"#10B981","adjustment_type":"none"}]'::jsonb;
  END IF;
  IF p_services IS NOT NULL AND jsonb_typeof(p_services) = 'array' AND jsonb_array_length(p_services) > 0 THEN
    SELECT (s->>'service_id')::uuid INTO v_invalid_service FROM jsonb_array_elements(p_services) s
    WHERE NOT EXISTS (SELECT 1 FROM public.services sv WHERE sv.id = (s->>'service_id')::uuid AND sv.team_id = p_team_id) LIMIT 1;
    IF v_invalid_service IS NOT NULL THEN RAISE EXCEPTION 'Service % does not belong to this team', v_invalid_service USING ERRCODE = '22000'; END IF;
  END IF;
  INSERT INTO public.boards (team_id, name, description, created_by, is_default, monthly_demand_limit)
  VALUES (p_team_id, v_trim_name, nullif(trim(p_description), ''), v_user_id, false, 0)
  RETURNING * INTO v_new_board;
  WITH base AS (
    SELECT v_user_id AS user_id, 'admin'::team_role AS role, 1 AS prio
    UNION ALL SELECT tm.user_id, 'moderator'::team_role, 2 FROM public.team_members tm
    WHERE tm.team_id = p_team_id AND tm.role = 'admin' AND tm.user_id <> v_user_id
    UNION ALL SELECT (m->>'user_id')::uuid, COALESCE(NULLIF(m->>'role',''), 'executor')::team_role, 3
    FROM jsonb_array_elements(COALESCE(p_members, '[]'::jsonb)) m
    WHERE EXISTS (SELECT 1 FROM public.team_members tm2 WHERE tm2.team_id = p_team_id AND tm2.user_id = (m->>'user_id')::uuid)
  ), ranked AS (SELECT user_id, role, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY prio) AS rn FROM base)
  INSERT INTO public.board_members (board_id, user_id, role, added_by)
  SELECT v_new_board.id, user_id, role, v_user_id FROM ranked WHERE rn = 1
  ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  WITH stages_in AS (
    SELECT ord - 1 AS pos, trim(s.value->>'name') AS name,
      COALESCE(NULLIF(s.value->>'color',''), '#6B7280') AS color,
      COALESCE(NULLIF(s.value->>'adjustment_type',''), 'none')::adjustment_type AS adj
    FROM jsonb_array_elements(v_stages) WITH ORDINALITY AS s(value, ord)
  ), inserted_status AS (
    INSERT INTO public.demand_statuses (name, color, board_id, is_system)
    SELECT name, color, v_new_board.id, true FROM stages_in ORDER BY pos
    RETURNING id, name
  ), pairs AS (
    SELECT si.pos, si.adj, (SELECT i.id FROM inserted_status i WHERE i.name = si.name LIMIT 1) AS status_id FROM stages_in si
  )
  INSERT INTO public.board_statuses (board_id, status_id, position, is_active, adjustment_type)
  SELECT v_new_board.id, status_id, pos, true, adj FROM pairs WHERE status_id IS NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM public.demand_statuses WHERE board_id = v_new_board.id AND lower(name) = 'entregue') THEN
    WITH ins AS (INSERT INTO public.demand_statuses (name, color, board_id, is_system) VALUES ('Entregue', '#10B981', v_new_board.id, true) RETURNING id)
    INSERT INTO public.board_statuses (board_id, status_id, position, is_active, adjustment_type)
    SELECT v_new_board.id, ins.id, COALESCE((SELECT MAX(position) + 1 FROM public.board_statuses WHERE board_id = v_new_board.id), 0), true, 'none'::adjustment_type FROM ins;
  END IF;
  IF p_services IS NOT NULL AND jsonb_typeof(p_services) = 'array' AND jsonb_array_length(p_services) > 0 THEN
    INSERT INTO public.board_services (board_id, service_id, monthly_limit)
    SELECT v_new_board.id, (s->>'service_id')::uuid, COALESCE((s->>'monthly_limit')::int, 0)
    FROM jsonb_array_elements(p_services) s ON CONFLICT DO NOTHING;
  END IF;
  RETURN v_new_board;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_demand_dependency()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_status_name TEXT; v_unmet RECORD;
BEGIN
  IF OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN RETURN NEW; END IF;
  IF NEW.parent_demand_id IS NULL THEN RETURN NEW; END IF;
  SELECT name INTO new_status_name FROM public.demand_statuses WHERE id = NEW.status_id;
  IF new_status_name = 'Fazendo' THEN
    SELECT d.id, d.title, ds.name AS status_name INTO v_unmet
    FROM public.demand_dependencies dd
    JOIN public.demands d ON d.id = dd.depends_on_demand_id
    JOIN public.demand_statuses ds ON ds.id = d.status_id
    WHERE dd.demand_id = NEW.id AND ds.name != 'Entregue' LIMIT 1;
    IF v_unmet IS NOT NULL THEN
      RAISE EXCEPTION 'Subdemanda depende de "%" que ainda não foi concluída (status: %)', v_unmet.title, v_unmet.status_name;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_demand_with_subdemands(p_parent jsonb, p_subdemands jsonb DEFAULT '[]', p_dependencies jsonb DEFAULT '[]')
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_user_id UUID; v_parent_id UUID; v_sub_ids UUID[]; v_sub JSONB; v_dep JSONB; v_sub_id UUID; v_idx INTEGER; v_dep_idx INTEGER; v_depends_on_idx INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_board_member(v_user_id, (p_parent->>'board_id')::UUID) THEN RAISE EXCEPTION 'Not a board member'; END IF;
  INSERT INTO public.demands (title, description, team_id, board_id, status_id, priority, assigned_to, due_date, service_id, created_by)
  VALUES (p_parent->>'title', p_parent->>'description', (p_parent->>'team_id')::UUID, (p_parent->>'board_id')::UUID,
    (p_parent->>'status_id')::UUID, COALESCE(p_parent->>'priority', 'média'),
    (p_parent->>'assigned_to')::UUID, (p_parent->>'due_date')::TIMESTAMPTZ,
    (p_parent->>'service_id')::UUID, v_user_id) RETURNING id INTO v_parent_id;
  v_sub_ids := ARRAY[]::UUID[]; v_idx := 0;
  FOR v_sub IN SELECT * FROM jsonb_array_elements(p_subdemands) LOOP
    INSERT INTO public.demands (title, description, team_id, board_id, status_id, priority, assigned_to, due_date, service_id, created_by, parent_demand_id)
    VALUES (v_sub->>'title', v_sub->>'description', (p_parent->>'team_id')::UUID, (p_parent->>'board_id')::UUID,
      (v_sub->>'status_id')::UUID, COALESCE(v_sub->>'priority', 'média'),
      (v_sub->>'assigned_to')::UUID, (v_sub->>'due_date')::TIMESTAMPTZ,
      (v_sub->>'service_id')::UUID, v_user_id, v_parent_id) RETURNING id INTO v_sub_id;
    v_sub_ids := array_append(v_sub_ids, v_sub_id); v_idx := v_idx + 1;
  END LOOP;
  FOR v_dep IN SELECT * FROM jsonb_array_elements(p_dependencies) LOOP
    v_dep_idx := (v_dep->>'demand_index')::INTEGER;
    v_depends_on_idx := (v_dep->>'depends_on_index')::INTEGER;
    IF v_dep_idx < 1 OR v_dep_idx > array_length(v_sub_ids, 1) THEN RAISE EXCEPTION 'Invalid demand_index: %', v_dep_idx; END IF;
    IF v_depends_on_idx < 1 OR v_depends_on_idx > array_length(v_sub_ids, 1) THEN RAISE EXCEPTION 'Invalid depends_on_index: %', v_depends_on_idx; END IF;
    INSERT INTO public.demand_dependencies (demand_id, depends_on_demand_id)
    VALUES (v_sub_ids[v_dep_idx], v_sub_ids[v_depends_on_idx]);
  END LOOP;
  RETURN jsonb_build_object('parent_id', v_parent_id, 'subdemand_ids', to_jsonb(v_sub_ids));
END;
$function$;