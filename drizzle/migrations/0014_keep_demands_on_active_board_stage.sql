-- Every non-archived demand must sit in a stage the board's Kanban shows.
-- The Kanban groups cards by stage NAME (column key = demand_statuses.name of an
-- active board_statuses row); a demand whose stage name is not active on its
-- board is silently invisible. Recurring templates, stage deactivation and
-- foreign status ids were producing ~200 invisible demands.

-- 1) Entry stage of a board: first active stage that is not delivery, request
--    intake, timer or approval (falls back through those in that order).
CREATE OR REPLACE FUNCTION public.board_entry_status_id(_board_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT bs.status_id
  FROM public.board_statuses bs
  JOIN public.demand_statuses ds ON ds.id = bs.status_id
  WHERE bs.board_id = _board_id
    AND bs.is_active
    AND lower(btrim(ds.name)) <> 'entregue'
  ORDER BY
    CASE
      WHEN lower(btrim(ds.name)) IN ('fazendo', 'em ajuste', 'ajuste') THEN 3
      WHEN lower(btrim(ds.name)) IN ('solicitações', 'solicitacoes', 'atrasado') THEN 2
      WHEN lower(btrim(ds.name)) LIKE 'aprova%'
        OR lower(btrim(ds.name)) LIKE 'em revis%'
        OR lower(btrim(ds.name)) LIKE 'em_aprova%' THEN 1
      ELSE 0
    END,
    bs.position
  LIMIT 1
$$;

-- 2) Stage a demand should be in so the board's Kanban shows it.
CREATE OR REPLACE FUNCTION public.resolve_board_demand_status(_board_id uuid, _status_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _name text;
  _match uuid;
BEGIN
  IF _board_id IS NULL OR _status_id IS NULL THEN
    RETURN _status_id;
  END IF;

  SELECT name INTO _name FROM public.demand_statuses WHERE id = _status_id;

  -- Already visible: an active stage of this board has exactly this name.
  IF EXISTS (
    SELECT 1
    FROM public.board_statuses bs
    JOIN public.demand_statuses ds ON ds.id = bs.status_id
    WHERE bs.board_id = _board_id AND bs.is_active AND ds.name = _name
  ) THEN
    RETURN _status_id;
  END IF;

  -- Never pull a delivered demand out of delivery.
  IF lower(btrim(coalesce(_name, ''))) = 'entregue' THEN
    RETURN _status_id;
  END IF;

  -- Same stage spelled differently on this board ("A Iniciar" vs "A iniciar").
  SELECT bs.status_id INTO _match
  FROM public.board_statuses bs
  JOIN public.demand_statuses ds ON ds.id = bs.status_id
  WHERE bs.board_id = _board_id
    AND bs.is_active
    AND lower(btrim(ds.name)) = lower(btrim(coalesce(_name, '')))
  ORDER BY bs.position
  LIMIT 1;

  IF _match IS NOT NULL THEN
    RETURN _match;
  END IF;

  RETURN coalesce(public.board_entry_status_id(_board_id), _status_id);
END;
$$;

-- 3) Enforce on every write path (UI, recurring cron, MCP, API, imports, board moves, trash restore).
--    Name starts with "a0_" so it runs before the other BEFORE triggers, which
--    then see the final stage (timer, delivered_at, overdue, dependencies).
CREATE OR REPLACE FUNCTION public.trg_keep_demand_on_active_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.archived THEN
    RETURN NEW;
  END IF;
  NEW.status_id := public.resolve_board_demand_status(NEW.board_id, NEW.status_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a0_keep_demand_on_active_stage ON public.demands;
CREATE TRIGGER a0_keep_demand_on_active_stage
  BEFORE INSERT OR UPDATE OF status_id, board_id, archived ON public.demands
  FOR EACH ROW EXECUTE FUNCTION public.trg_keep_demand_on_active_stage();

-- 4) Bulk stage moves must not send one "status changed" notification per demand.
CREATE OR REPLACE FUNCTION public.notify_demand_status_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE old_status_name TEXT; new_status_name TEXT; assignee RECORD; board_admin RECORD; notification_type TEXT; notified_users UUID[];
BEGIN
  IF OLD.status_id = NEW.status_id THEN RETURN NEW; END IF;
  IF coalesce(current_setting('soma.bulk_stage_move', true), '') = 'on' THEN RETURN NEW; END IF;
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

-- 5) A stage that still holds demands cannot be switched off directly
--    (they would vanish from the Kanban); use deactivate_board_stage.
CREATE OR REPLACE FUNCTION public.trg_guard_board_stage_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _name text;
  _count integer;
BEGIN
  IF NOT (OLD.is_active AND NOT NEW.is_active) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO _name FROM public.demand_statuses WHERE id = NEW.status_id;

  -- Another active stage with the same name keeps those demands visible.
  IF EXISTS (
    SELECT 1
    FROM public.board_statuses bs
    JOIN public.demand_statuses ds ON ds.id = bs.status_id
    WHERE bs.board_id = NEW.board_id AND bs.is_active AND bs.id <> NEW.id AND ds.name = _name
  ) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO _count
  FROM public.demands d
  JOIN public.demand_statuses ds ON ds.id = d.status_id
  WHERE d.board_id = NEW.board_id AND NOT d.archived AND ds.name = _name;

  IF _count > 0 THEN
    RAISE EXCEPTION 'STAGE_HAS_DEMANDS'
      USING ERRCODE = 'P0001',
            DETAIL = _count::text,
            HINT = 'Mova as demandas desta etapa (deactivate_board_stage) antes de desativá-la.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_board_stage_deactivation ON public.board_statuses;
CREATE TRIGGER guard_board_stage_deactivation
  BEFORE UPDATE OF is_active ON public.board_statuses
  FOR EACH ROW EXECUTE FUNCTION public.trg_guard_board_stage_deactivation();

-- 6) Deactivate a stage moving its demands to a chosen active stage, atomically.
CREATE OR REPLACE FUNCTION public.deactivate_board_stage(_board_status_id uuid, _target_status_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := (select auth.uid());
  _bs record;
  _name text;
  _target_name text;
  _moved integer := 0;
BEGIN
  SELECT * INTO _bs FROM public.board_statuses WHERE id = _board_status_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada';
  END IF;

  IF _uid IS NULL OR NOT (
    public.is_board_admin_or_moderator(_uid, _bs.board_id)
    OR public.is_team_admin_or_moderator_for_board(_uid, _bs.board_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar as etapas deste quadro' USING ERRCODE = '42501';
  END IF;

  IF NOT _bs.is_active THEN
    RETURN 0;
  END IF;

  SELECT name INTO _name FROM public.demand_statuses WHERE id = _bs.status_id;

  IF lower(btrim(coalesce(_name, ''))) = 'entregue' AND NOT EXISTS (
    SELECT 1 FROM public.board_statuses bs
    JOIN public.demand_statuses ds ON ds.id = bs.status_id
    WHERE bs.board_id = _bs.board_id AND bs.is_active AND bs.id <> _bs.id AND ds.name = _name
  ) THEN
    RAISE EXCEPTION 'A etapa "Entregue" é obrigatória e não pode ser desativada';
  END IF;

  SELECT ds.name INTO _target_name
  FROM public.board_statuses bs
  JOIN public.demand_statuses ds ON ds.id = bs.status_id
  WHERE bs.board_id = _bs.board_id
    AND bs.is_active
    AND bs.id <> _bs.id
    AND bs.status_id = _target_status_id
  LIMIT 1;

  IF _target_name IS NULL THEN
    RAISE EXCEPTION 'Escolha uma etapa ativa deste quadro como destino';
  END IF;

  IF lower(btrim(_target_name)) IN ('fazendo', 'em ajuste', 'ajuste') THEN
    RAISE EXCEPTION 'Escolha uma etapa sem cronômetro como destino';
  END IF;

  -- Only move when no other active stage with the same name keeps them visible.
  IF NOT EXISTS (
    SELECT 1 FROM public.board_statuses bs
    JOIN public.demand_statuses ds ON ds.id = bs.status_id
    WHERE bs.board_id = _bs.board_id AND bs.is_active AND bs.id <> _bs.id AND ds.name = _name
  ) THEN
    PERFORM set_config('soma.bulk_stage_move', 'on', true);
    UPDATE public.demands d
    SET status_id = _target_status_id
    FROM public.demand_statuses ds
    WHERE ds.id = d.status_id
      AND d.board_id = _bs.board_id
      AND NOT d.archived
      AND ds.name = _name;
    GET DIAGNOSTICS _moved = ROW_COUNT;
    PERFORM set_config('soma.bulk_stage_move', 'off', true);
  END IF;

  UPDATE public.board_statuses SET is_active = false WHERE id = _bs.id;

  RETURN _moved;
END;
$$;

REVOKE ALL ON FUNCTION public.board_entry_status_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_board_demand_status(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trg_keep_demand_on_active_stage() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trg_guard_board_stage_deactivation() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.deactivate_board_stage(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.board_entry_status_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_board_demand_status(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deactivate_board_stage(uuid, uuid) TO authenticated, service_role;

-- 7) Repair: bring every invisible demand back to a visible stage, without
--    notification spam and keeping its original "status changed at".
CREATE TEMP TABLE _stage_repair ON COMMIT DROP AS
SELECT d.id,
       d.status_changed_at,
       public.resolve_board_demand_status(d.board_id, d.status_id) AS new_status_id,
       d.status_id AS old_status_id
FROM public.demands d
WHERE NOT d.archived;

DELETE FROM _stage_repair WHERE new_status_id IS NOT DISTINCT FROM old_status_id;

SELECT set_config('soma.bulk_stage_move', 'on', true);

UPDATE public.demands d
SET status_id = r.new_status_id
FROM _stage_repair r
WHERE d.id = r.id;

UPDATE public.demands d
SET status_changed_at = r.status_changed_at
FROM _stage_repair r
WHERE d.id = r.id;

SELECT set_config('soma.bulk_stage_move', 'off', true);

-- Recurring templates pointing at stages the board no longer shows.
UPDATE public.recurring_demands rd
SET status_id = public.resolve_board_demand_status(rd.board_id, rd.status_id)
WHERE rd.board_id IS NOT NULL
  AND rd.status_id IS NOT NULL
  AND rd.status_id IS DISTINCT FROM public.resolve_board_demand_status(rd.board_id, rd.status_id);
