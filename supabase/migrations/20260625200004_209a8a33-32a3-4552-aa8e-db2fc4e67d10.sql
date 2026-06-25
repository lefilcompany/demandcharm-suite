CREATE OR REPLACE FUNCTION public.is_project_owner(_user_id uuid, _project_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND created_by = _user_id) $$;

CREATE OR REPLACE FUNCTION public.is_folder_owner(_user_id uuid, _folder_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT public.is_project_owner(_user_id, _folder_id) $$;

CREATE OR REPLACE FUNCTION public.is_demand_shared(demand_id_param uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM demand_share_tokens dst WHERE dst.demand_id = demand_id_param AND dst.is_active = true AND (dst.expires_at IS NULL OR dst.expires_at > now())); $$;

CREATE OR REPLACE FUNCTION public.is_note_owner(_note_id uuid, _user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.notes WHERE id = _note_id AND created_by = _user_id) $$;

CREATE OR REPLACE FUNCTION public.is_note_shared(note_id_param uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM note_share_tokens nst WHERE nst.note_id = note_id_param AND nst.is_active = true AND (nst.expires_at IS NULL OR nst.expires_at > now())); $$;

CREATE OR REPLACE FUNCTION public.is_note_shared_with_user(_note_id uuid, _user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.note_shares WHERE note_id = _note_id AND shared_with_user_id = _user_id) $$;

CREATE OR REPLACE FUNCTION public.is_team_creator(_user_id uuid, _team_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = _team_id AND t.created_by = _user_id); $$;

CREATE OR REPLACE FUNCTION public.join_board_via_share_token(p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_user_id uuid; v_token RECORD; v_demand RECORD; v_is_team_member boolean; v_already_member boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated'); END IF;
  SELECT id, demand_id, is_active, expires_at, auto_join_board, created_by INTO v_token FROM public.demand_share_tokens WHERE token = p_token;
  IF v_token IS NULL OR NOT v_token.is_active THEN RETURN jsonb_build_object('success', false, 'reason', 'invalid_token'); END IF;
  IF v_token.expires_at IS NOT NULL AND v_token.expires_at <= now() THEN RETURN jsonb_build_object('success', false, 'reason', 'invalid_token'); END IF;
  SELECT id, board_id, team_id INTO v_demand FROM public.demands WHERE id = v_token.demand_id;
  IF v_demand IS NULL THEN RETURN jsonb_build_object('success', false, 'reason', 'invalid_token'); END IF;
  SELECT EXISTS(SELECT 1 FROM public.board_members WHERE board_id = v_demand.board_id AND user_id = v_user_id) INTO v_already_member;
  IF v_already_member THEN RETURN jsonb_build_object('success', true, 'reason', 'already_member', 'demand_id', v_demand.id, 'board_id', v_demand.board_id); END IF;
  IF NOT v_token.auto_join_board THEN RETURN jsonb_build_object('success', false, 'reason', 'auto_join_disabled'); END IF;
  SELECT EXISTS(SELECT 1 FROM public.team_members WHERE team_id = v_demand.team_id AND user_id = v_user_id) INTO v_is_team_member;
  IF NOT v_is_team_member THEN RETURN jsonb_build_object('success', false, 'reason', 'not_team_member'); END IF;
  INSERT INTO public.board_members (board_id, user_id, role, added_by) VALUES (v_demand.board_id, v_user_id, 'executor'::team_role, v_token.created_by) ON CONFLICT (board_id, user_id) DO NOTHING;
  RETURN jsonb_build_object('success', true, 'reason', 'joined', 'demand_id', v_demand.id, 'board_id', v_demand.board_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.join_team_with_code(p_code text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_team_id uuid; v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO v_team_id FROM teams WHERE access_code = upper(trim(p_code));
  IF v_team_id IS NULL THEN RAISE EXCEPTION 'Invalid access code'; END IF;
  INSERT INTO team_members (team_id, user_id, role) VALUES (v_team_id, v_user_id, 'requester'::team_role);
  RETURN v_team_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.normalize_demand_due_date() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.due_date IS NOT NULL THEN
    NEW.due_date := date_trunc('day', NEW.due_date AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' + INTERVAL '23 hours 59 minutes 59 seconds';
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_adjustment_completed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE old_status_name TEXT; new_status_name TEXT; board_admin RECORD;
BEGIN
  IF OLD.status_id = NEW.status_id THEN RETURN NEW; END IF;
  SELECT name INTO old_status_name FROM demand_statuses WHERE id = OLD.status_id;
  SELECT name INTO new_status_name FROM demand_statuses WHERE id = NEW.status_id;
  IF old_status_name = 'Em Ajuste' AND new_status_name = 'Entregue' THEN
    INSERT INTO notifications (user_id, title, message, type, link) VALUES (NEW.created_by, 'Ajuste concluído', 'O ajuste na demanda "' || NEW.title || '" foi finalizado. A demanda voltou para Entregue.', 'success', '/demands/' || NEW.id);
    FOR board_admin IN SELECT user_id FROM board_members WHERE board_id = NEW.board_id AND role = 'admin' AND user_id != NEW.created_by LOOP
      INSERT INTO notifications (user_id, title, message, type, link) VALUES (board_admin.user_id, 'Ajuste concluído', 'O ajuste na demanda "' || NEW.title || '" foi finalizado. A demanda voltou para Entregue.', 'success', '/demands/' || NEW.id);
    END LOOP;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_assignee_added() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE demand_title TEXT;
BEGIN
  SELECT title INTO demand_title FROM demands WHERE id = NEW.demand_id;
  INSERT INTO notifications (user_id, title, message, type, link) VALUES (NEW.user_id, 'Você foi atribuído a uma demanda', 'Você foi designado para trabalhar na demanda "' || demand_title || '"', 'info', '/demands/' || NEW.demand_id);
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_demand_assigned() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE demand_record RECORD;
BEGIN
  IF NEW.assigned_to IS NULL OR (OLD.assigned_to IS NOT NULL AND OLD.assigned_to = NEW.assigned_to) THEN RETURN NEW; END IF;
  INSERT INTO notifications (user_id, title, message, type, link) VALUES (NEW.assigned_to, 'Demanda atribuída a você', 'Você foi atribuído à demanda "' || NEW.title || '"', 'info', '/demands/' || NEW.id);
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_demand_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE board_admin RECORD; demand_title TEXT; creator_name TEXT;
BEGIN
  demand_title := NEW.title;
  SELECT full_name INTO creator_name FROM profiles WHERE id = NEW.created_by;
  FOR board_admin IN SELECT user_id FROM board_members WHERE board_id = NEW.board_id AND role = 'admin' AND user_id != NEW.created_by LOOP
    INSERT INTO notifications (user_id, title, message, type, link) VALUES (board_admin.user_id, 'Nova demanda criada', creator_name || ' criou a demanda "' || demand_title || '"', 'info', '/demands/' || NEW.id);
  END LOOP;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_demand_request_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE admin_member RECORD; requester_name TEXT; team_name TEXT;
BEGIN
  SELECT full_name INTO requester_name FROM profiles WHERE id = NEW.created_by;
  SELECT name INTO team_name FROM teams WHERE id = NEW.team_id;
  IF NEW.board_id IS NOT NULL THEN
    FOR admin_member IN SELECT user_id FROM board_members WHERE board_id = NEW.board_id AND role IN ('admin', 'moderator') AND user_id != NEW.created_by LOOP
      INSERT INTO notifications (user_id, title, message, type, link) VALUES (admin_member.user_id, 'Nova solicitação de demanda', requester_name || ' solicitou a criação de uma demanda: "' || NEW.title || '"', 'info', '/demand-requests');
    END LOOP;
  ELSE
    FOR admin_member IN SELECT user_id FROM team_members WHERE team_id = NEW.team_id AND role = 'admin' AND user_id != NEW.created_by LOOP
      INSERT INTO notifications (user_id, title, message, type, link) VALUES (admin_member.user_id, 'Nova solicitação de demanda', requester_name || ' solicitou a criação de uma demanda: "' || NEW.title || '"', 'info', '/demand-requests');
    END LOOP;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_demand_request_status_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE responder_name TEXT;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  SELECT full_name INTO responder_name FROM profiles WHERE id = NEW.responded_by;
  IF NEW.status = 'approved' THEN
    INSERT INTO notifications (user_id, title, message, type, link) VALUES (NEW.created_by, 'Solicitação aprovada!', 'Sua solicitação de demanda "' || NEW.title || '" foi aprovada por ' || responder_name, 'success', '/demands');
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO notifications (user_id, title, message, type, link) VALUES (NEW.created_by, 'Solicitação rejeitada', 'Sua solicitação "' || NEW.title || '" foi rejeitada. Motivo: ' || COALESCE(NEW.rejection_reason, 'Não informado'), 'error', '/my-requests');
  ELSIF NEW.status = 'returned' THEN
    INSERT INTO notifications (user_id, title, message, type, link) VALUES (NEW.created_by, 'Solicitação devolvida para revisão', 'Sua solicitação "' || NEW.title || '" foi devolvida: ' || COALESCE(NEW.rejection_reason, 'Ajustes necessários'), 'warning', '/my-requests');
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_demand_status_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE old_status_name TEXT; new_status_name TEXT; assignee RECORD; board_admin RECORD; notification_type TEXT; notified_users UUID[];
BEGIN
  IF OLD.status_id = NEW.status_id THEN RETURN NEW; END IF;
  SELECT name INTO old_status_name FROM demand_statuses WHERE id = OLD.status_id;
  SELECT name INTO new_status_name FROM demand_statuses WHERE id = NEW.status_id;
  notification_type := CASE WHEN new_status_name = 'Entregue' THEN 'success' WHEN new_status_name = 'Em Ajuste' THEN 'warning' ELSE 'info' END;
  notified_users := ARRAY[]::UUID[];
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, link) VALUES (NEW.created_by, 'Status atualizado', 'A demanda "' || NEW.title || '" mudou de "' || old_status_name || '" para "' || new_status_name || '"', notification_type, '/demands/' || NEW.id);
    notified_users := array_append(notified_users, NEW.created_by);
  END IF;
  FOR assignee IN SELECT user_id FROM demand_assignees WHERE demand_id = NEW.id AND user_id != ALL(notified_users) LOOP
    INSERT INTO notifications (user_id, title, message, type, link) VALUES (assignee.user_id, 'Status atualizado', 'A demanda "' || NEW.title || '" mudou de "' || old_status_name || '" para "' || new_status_name || '"', notification_type, '/demands/' || NEW.id);
    notified_users := array_append(notified_users, assignee.user_id);
  END LOOP;
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != ALL(notified_users) THEN
    INSERT INTO notifications (user_id, title, message, type, link) VALUES (NEW.assigned_to, 'Status atualizado', 'A demanda "' || NEW.title || '" mudou de "' || old_status_name || '" para "' || new_status_name || '"', notification_type, '/demands/' || NEW.id);
    notified_users := array_append(notified_users, NEW.assigned_to);
  END IF;
  FOR board_admin IN SELECT user_id FROM board_members WHERE board_id = NEW.board_id AND role = 'admin' AND user_id != ALL(notified_users) LOOP
    INSERT INTO notifications (user_id, title, message, type, link) VALUES (board_admin.user_id, 'Status atualizado', 'A demanda "' || NEW.title || '" mudou de "' || old_status_name || '" para "' || new_status_name || '"', notification_type, '/demands/' || NEW.id);
  END LOOP;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_mention() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE mentioned_user_id UUID; demand_title TEXT; demand_board_id UUID; is_board_member BOOLEAN; mention_match TEXT[];
BEGIN
  SELECT title, board_id INTO demand_title, demand_board_id FROM demands WHERE id = NEW.demand_id;
  FOR mention_match IN SELECT regexp_matches(NEW.content, '\[\[([0-9a-f-]+):([^\]]+)\]\]', 'g') LOOP
    mentioned_user_id := mention_match[1]::UUID;
    IF mentioned_user_id IS NOT NULL AND mentioned_user_id != NEW.user_id THEN
      SELECT EXISTS(SELECT 1 FROM board_members WHERE board_id = demand_board_id AND user_id = mentioned_user_id) INTO is_board_member;
      IF is_board_member THEN
        INSERT INTO notifications (user_id, title, message, type, link) VALUES (mentioned_user_id, 'Você foi mencionado', 'Você foi mencionado em um comentário na demanda "' || left(demand_title, 100) || '"', 'info', '/demands/' || NEW.demand_id);
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_request_comment_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE request_record RECORD; commenter_name TEXT; commenter_role TEXT;
BEGIN
  SELECT * INTO request_record FROM public.demand_requests WHERE id = NEW.request_id;
  SELECT full_name INTO commenter_name FROM public.profiles WHERE id = NEW.user_id;
  SELECT role::text INTO commenter_role FROM public.team_members WHERE user_id = NEW.user_id AND team_id = request_record.team_id;
  IF commenter_role != 'admin' THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT tm.user_id, 'Novo comentário em solicitação', COALESCE(commenter_name, 'Um usuário') || ' comentou na solicitação "' || request_record.title || '"', 'info', '/demand-requests'
    FROM public.team_members tm WHERE tm.team_id = request_record.team_id AND tm.role = 'admin' AND tm.user_id != NEW.user_id;
  END IF;
  IF request_record.created_by != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, link) VALUES (request_record.created_by, 'Novo comentário na sua solicitação', COALESCE(commenter_name, 'Um usuário') || ' comentou na sua solicitação "' || request_record.title || '"', 'info', '/my-requests');
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_team_join_request_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE admin_member RECORD; requester_name TEXT; team_name TEXT;
BEGIN
  SELECT full_name INTO requester_name FROM profiles WHERE id = NEW.user_id;
  SELECT name INTO team_name FROM teams WHERE id = NEW.team_id;
  FOR admin_member IN SELECT user_id FROM team_members WHERE team_id = NEW.team_id AND role = 'admin' LOOP
    INSERT INTO notifications (user_id, title, message, type, link) VALUES (admin_member.user_id, 'Nova solicitação de entrada', COALESCE(requester_name, 'Um usuário') || ' solicitou entrada na equipe "' || COALESCE(team_name, 'sua equipe') || '"', 'info', '/teams/' || NEW.team_id || '/requests');
  END LOOP;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_team_join_request_responded() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE team_name TEXT;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  SELECT name INTO team_name FROM teams WHERE id = NEW.team_id;
  IF NEW.status = 'approved' THEN
    INSERT INTO notifications (user_id, title, message, type, link) VALUES (NEW.user_id, 'Solicitação aprovada!', 'Sua solicitação para entrar na equipe "' || COALESCE(team_name, 'equipe') || '" foi aprovada!', 'success', '/teams/' || NEW.team_id);
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO notifications (user_id, title, message, type, link) VALUES (NEW.user_id, 'Solicitação rejeitada', 'Sua solicitação para entrar na equipe "' || COALESCE(team_name, 'equipe') || '" foi rejeitada.', 'error', '/welcome');
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.promote_to_admin_by_email(p_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = lower(p_email);
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  UPDATE public.user_roles SET role = 'admin' WHERE user_id = v_user_id;
  IF NOT FOUND THEN INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'admin'); END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public.propagate_status_to_subdemands(p_parent_id uuid, p_new_status_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_user_id uuid; v_parent RECORD; v_delivered_status_id uuid; v_subdemand RECORD; v_active_entry RECORD; v_updated_count integer := 0; v_stopped_timers integer := 0; v_now timestamptz := now();
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_parent_id IS NULL OR p_new_status_id IS NULL THEN RAISE EXCEPTION 'p_parent_id and p_new_status_id are required'; END IF;
  SELECT id, board_id, parent_demand_id, team_id INTO v_parent FROM public.demands WHERE id = p_parent_id;
  IF v_parent IS NULL THEN RAISE EXCEPTION 'Parent demand not found'; END IF;
  IF NOT public.is_board_member(v_user_id, v_parent.board_id) THEN RAISE EXCEPTION 'Permission denied: not a board member'; END IF;
  SELECT id INTO v_delivered_status_id FROM public.demand_statuses WHERE name = 'Entregue' LIMIT 1;
  FOR v_subdemand IN SELECT id, status_id, last_started_at, time_in_progress_seconds FROM public.demands WHERE parent_demand_id = p_parent_id AND archived = false AND status_id <> p_new_status_id LOOP
    FOR v_active_entry IN SELECT id, started_at FROM public.demand_time_entries WHERE demand_id = v_subdemand.id AND ended_at IS NULL LOOP
      UPDATE public.demand_time_entries SET ended_at = v_now, duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_active_entry.started_at))::integer) WHERE id = v_active_entry.id;
      v_stopped_timers := v_stopped_timers + 1;
    END LOOP;
    UPDATE public.demands SET status_id = p_new_status_id, status_changed_by = v_user_id, status_changed_at = v_now WHERE id = v_subdemand.id;
    v_updated_count := v_updated_count + 1;
  END LOOP;
  RETURN jsonb_build_object('updated_count', v_updated_count, 'stopped_timers', v_stopped_timers);
END; $function$;

CREATE OR REPLACE FUNCTION public.reassign_demand_sequence_on_board_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE next_seq INTEGER;
BEGIN
  IF NEW.board_id IS DISTINCT FROM OLD.board_id THEN
    SELECT COALESCE(MAX(board_sequence_number), 0) + 1 INTO next_seq FROM public.demands WHERE board_id = NEW.board_id AND id <> NEW.id;
    NEW.board_sequence_number := next_seq;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.redeem_trial_coupon(p_code text, p_team_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_coupon RECORD; v_plan RECORD; v_user_id uuid; v_existing_sub uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_authenticated'); END IF;
  SELECT * INTO v_coupon FROM trial_coupons WHERE upper(trim(code)) = upper(trim(p_code)) AND is_active = true AND (expires_at IS NULL OR expires_at > now()) AND times_used < max_uses FOR UPDATE;
  IF v_coupon IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_coupon'); END IF;
  IF EXISTS (SELECT 1 FROM coupon_redemptions WHERE coupon_id = v_coupon.id AND team_id = p_team_id) THEN RETURN jsonb_build_object('success', false, 'error', 'already_redeemed'); END IF;
  SELECT * INTO v_plan FROM plans WHERE id = v_coupon.plan_id AND is_active = true;
  IF v_plan IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'plan_not_found'); END IF;
  UPDATE trial_coupons SET times_used = times_used + 1 WHERE id = v_coupon.id;
  IF (v_coupon.times_used + 1) >= v_coupon.max_uses THEN UPDATE trial_coupons SET is_active = false WHERE id = v_coupon.id; END IF;
  INSERT INTO coupon_redemptions (coupon_id, team_id, redeemed_by) VALUES (v_coupon.id, p_team_id, v_user_id);
  SELECT id INTO v_existing_sub FROM subscriptions WHERE team_id = p_team_id LIMIT 1;
  IF v_existing_sub IS NOT NULL THEN
    UPDATE subscriptions SET plan_id = v_plan.id, status = 'trialing', trial_ends_at = now() + (v_coupon.trial_days || ' days')::interval, current_period_start = now(), current_period_end = now() + (v_coupon.trial_days || ' days')::interval, updated_at = now() WHERE id = v_existing_sub;
  ELSE
    INSERT INTO subscriptions (team_id, plan_id, status, trial_ends_at, current_period_start, current_period_end) VALUES (p_team_id, v_plan.id, 'trialing', now() + (v_coupon.trial_days || ' days')::interval, now(), now() + (v_coupon.trial_days || ' days')::interval);
  END IF;
  UPDATE profiles SET trial_ends_at = now() + (v_coupon.trial_days || ' days')::interval, updated_at = now() WHERE id = v_user_id;
  RETURN jsonb_build_object('success', true, 'trial_days', v_coupon.trial_days, 'plan_name', v_plan.name);
END; $function$;

CREATE OR REPLACE FUNCTION public.refresh_overdue_demands() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_delivered_status_id uuid; v_count integer;
BEGIN
  SELECT id INTO v_delivered_status_id FROM public.demand_statuses WHERE name = 'Entregue' LIMIT 1;
  WITH updated AS (UPDATE public.demands SET is_overdue = true WHERE archived = false AND due_date IS NOT NULL AND due_date < now() AND (status_id IS DISTINCT FROM v_delivered_status_id) AND is_overdue = false RETURNING 1)
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END; $function$;

CREATE OR REPLACE FUNCTION public.reorder_subdemands(p_parent_id uuid, p_ordered_ids uuid[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_user_id UUID; v_parent RECORD; v_can_edit BOOLEAN; v_id UUID; v_idx INTEGER := 1;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id, board_id, created_by INTO v_parent FROM public.demands WHERE id = p_parent_id;
  IF v_parent IS NULL THEN RAISE EXCEPTION 'Parent demand not found'; END IF;
  SELECT (public.is_board_admin_or_moderator(v_user_id, v_parent.board_id) OR v_parent.created_by = v_user_id OR EXISTS (SELECT 1 FROM public.demand_assignees WHERE demand_id = p_parent_id AND user_id = v_user_id)) INTO v_can_edit;
  IF NOT v_can_edit THEN RAISE EXCEPTION 'Permission denied to reorder subdemands'; END IF;
  FOREACH v_id IN ARRAY p_ordered_ids LOOP
    UPDATE public.demands SET subdemand_sort_order = v_idx WHERE id = v_id AND parent_demand_id = p_parent_id;
    v_idx := v_idx + 1;
  END LOOP;
END; $function$;

CREATE OR REPLACE FUNCTION public.set_demand_delivered_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE delivered_status_id UUID;
BEGIN
  SELECT id INTO delivered_status_id FROM public.demand_statuses WHERE name = 'Entregue' LIMIT 1;
  IF NEW.status_id = delivered_status_id AND (OLD.status_id IS NULL OR OLD.status_id != delivered_status_id) THEN NEW.delivered_at = NOW(); END IF;
  IF OLD.status_id = delivered_status_id AND NEW.status_id != delivered_status_id THEN NEW.delivered_at = NULL; END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.set_demand_sequence_number() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE next_seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(board_sequence_number), 0) + 1 INTO next_seq FROM public.demands WHERE board_id = NEW.board_id;
  NEW.board_sequence_number := next_seq;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.set_subdemand_sort_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.parent_demand_id IS NOT NULL AND NEW.subdemand_sort_order IS NULL THEN
    SELECT COALESCE(MAX(subdemand_sort_order), 0) + 1 INTO NEW.subdemand_sort_order FROM public.demands WHERE parent_demand_id = NEW.parent_demand_id;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.sync_admin_to_all_boards() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.role = 'admin' AND (OLD.role IS NULL OR OLD.role != 'admin') THEN
    INSERT INTO public.board_members (board_id, user_id, role, added_by) SELECT b.id, NEW.user_id, 'moderator'::team_role, NEW.user_id FROM public.boards b WHERE b.team_id = NEW.team_id
    ON CONFLICT (board_id, user_id) DO UPDATE SET role = 'moderator'::team_role;
  END IF;
  IF OLD.role = 'admin' AND NEW.role != 'admin' THEN
    UPDATE public.board_members SET role = 'executor'::team_role WHERE user_id = NEW.user_id AND board_id IN (SELECT id FROM public.boards WHERE team_id = NEW.team_id) AND role = 'moderator'::team_role;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.update_status_changed_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN NEW.status_changed_at := now(); END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.update_time_in_progress() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE old_status_name TEXT; new_status_name TEXT; elapsed_seconds INTEGER; running_demand RECORD;
BEGIN
  SELECT name INTO old_status_name FROM public.demand_statuses WHERE id = OLD.status_id;
  SELECT name INTO new_status_name FROM public.demand_statuses WHERE id = NEW.status_id;
  IF (old_status_name IN ('Fazendo', 'Em Ajuste')) AND (new_status_name NOT IN ('Fazendo', 'Em Ajuste')) THEN
    IF OLD.last_started_at IS NOT NULL THEN
      elapsed_seconds := EXTRACT(EPOCH FROM (now() - OLD.last_started_at))::INTEGER;
      NEW.time_in_progress_seconds := COALESCE(OLD.time_in_progress_seconds, 0) + elapsed_seconds;
    END IF;
    NEW.last_started_at := NULL;
  END IF;
  IF new_status_name = 'Fazendo' AND old_status_name != 'Fazendo' THEN
    FOR running_demand IN SELECT id, last_started_at, time_in_progress_seconds FROM public.demands WHERE team_id = NEW.team_id AND last_started_at IS NOT NULL AND id != NEW.id LOOP
      elapsed_seconds := EXTRACT(EPOCH FROM (now() - running_demand.last_started_at))::INTEGER;
      UPDATE public.demands SET last_started_at = NULL, time_in_progress_seconds = COALESCE(running_demand.time_in_progress_seconds, 0) + elapsed_seconds WHERE id = running_demand.id;
    END LOOP;
    NEW.last_started_at := now();
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.update_trial_coupon(p_coupon_id uuid, p_plan_id uuid, p_trial_days integer, p_max_uses integer, p_description text DEFAULT NULL::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_propagate boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_coupon RECORD; v_affected_teams integer := 0; v_redemption RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Permission denied'; END IF;
  SELECT * INTO v_coupon FROM trial_coupons WHERE id = p_coupon_id;
  IF v_coupon IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'coupon_not_found'); END IF;
  UPDATE trial_coupons SET plan_id = p_plan_id, trial_days = p_trial_days, max_uses = p_max_uses, description = p_description, expires_at = p_expires_at WHERE id = p_coupon_id;
  IF p_propagate THEN
    FOR v_redemption IN SELECT cr.team_id FROM coupon_redemptions cr WHERE cr.coupon_id = p_coupon_id LOOP
      UPDATE subscriptions SET plan_id = p_plan_id, trial_ends_at = created_at + (p_trial_days || ' days')::interval, current_period_end = created_at + (p_trial_days || ' days')::interval, updated_at = now() WHERE team_id = v_redemption.team_id AND status = 'trialing';
      IF FOUND THEN v_affected_teams := v_affected_teams + 1; END IF;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('success', true, 'affected_teams', v_affected_teams);
END; $function$;

CREATE OR REPLACE FUNCTION public.update_usage_on_demand_create() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  INSERT INTO public.usage_records (team_id, period_start, period_end, demands_created) VALUES (NEW.team_id, date_trunc('month', now()), date_trunc('month', now()) + interval '1 month', 1)
  ON CONFLICT (team_id, period_start) DO UPDATE SET demands_created = public.usage_records.demands_created + 1, updated_at = now();
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.validate_recurring_demand_frequency() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.frequency NOT IN ('daily', 'weekly', 'biweekly', 'monthly') THEN RAISE EXCEPTION 'Frequência inválida: %. Valores aceitos: daily, weekly, biweekly, monthly', NEW.frequency USING ERRCODE = '22000'; END IF;
  IF NEW.frequency IN ('weekly', 'biweekly') AND (NEW.weekdays IS NULL OR array_length(NEW.weekdays, 1) IS NULL) THEN RAISE EXCEPTION 'Recorrência semanal/quinzenal exige ao menos um dia da semana' USING ERRCODE = '22000'; END IF;
  IF NEW.frequency = 'monthly' AND NEW.day_of_month IS NULL THEN RAISE EXCEPTION 'Recorrência mensal exige um dia do mês' USING ERRCODE = '22000'; END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.verify_demand_share_token(p_token text) RETURNS TABLE(id uuid, demand_id uuid, is_active boolean, expires_at timestamp with time zone) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, demand_id, is_active, expires_at FROM demand_share_tokens WHERE token = p_token AND is_active = true AND (expires_at IS NULL OR expires_at > now());
$$;

CREATE OR REPLACE FUNCTION public.verify_note_share_token(p_token text) RETURNS TABLE(id uuid, note_id uuid, is_active boolean, expires_at timestamp with time zone) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, note_id, is_active, expires_at FROM note_share_tokens WHERE token = p_token AND is_active = true AND (expires_at IS NULL OR expires_at > now());
$$;