CREATE TABLE public.finance_team_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  cost_type text NOT NULL CHECK (cost_type IN ('fixa','operacional','administrativa')),
  monthly_amount numeric(14,2) NOT NULL CHECK (monthly_amount >= 0),
  valid_from date NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, cost_type, valid_from)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_team_costs TO authenticated;
GRANT ALL ON public.finance_team_costs TO service_role;
ALTER TABLE public.finance_team_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ftc_select" ON public.finance_team_costs FOR SELECT TO authenticated
  USING (public.has_finance_permission((select auth.uid()), 'finance.view_team', team_id));
CREATE POLICY "ftc_write" ON public.finance_team_costs FOR ALL TO authenticated
  USING (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id))
  WITH CHECK (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id));
CREATE TRIGGER trg_finance_team_costs_audit AFTER INSERT OR UPDATE OR DELETE ON public.finance_team_costs
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();

ALTER TABLE public.projects ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive'));

CREATE TABLE public.project_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('active','inactive')),
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid
);
CREATE INDEX project_status_history_pid ON public.project_status_history(project_id, changed_at);
GRANT SELECT ON public.project_status_history TO authenticated;
GRANT ALL ON public.project_status_history TO service_role;
ALTER TABLE public.project_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psh_select" ON public.project_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.is_team_member((select auth.uid()), p.team_id)));

ALTER TABLE public.finance_revenues ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX finance_revenues_project ON public.finance_revenues(project_id) WHERE project_id IS NOT NULL;

-- Active at any moment of the São Paulo month.
CREATE OR REPLACE FUNCTION public._project_active_in_month(_project_id uuid, _comp date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH b AS (SELECT (date_trunc('month', _comp)::timestamp AT TIME ZONE 'America/Sao_Paulo') s,
                    ((date_trunc('month', _comp) + interval '1 month')::timestamp AT TIME ZONE 'America/Sao_Paulo') e)
  SELECT EXISTS (SELECT 1 FROM projects p, b WHERE p.id = _project_id AND p.created_at < b.e)
    AND (
      coalesce((SELECT h.status FROM project_status_history h, b WHERE h.project_id = _project_id AND h.changed_at < b.s ORDER BY h.changed_at DESC LIMIT 1), 'active') = 'active'
      OR EXISTS (SELECT 1 FROM project_status_history h, b WHERE h.project_id = _project_id AND h.status = 'active' AND h.changed_at >= b.s AND h.changed_at < b.e)
    )
$$;
REVOKE ALL ON FUNCTION public._project_active_in_month(uuid, date) FROM PUBLIC, anon, authenticated;

-- Team cost values in force for the month + active finance projects that split them.
CREATE OR REPLACE FUNCTION public._finance_team_cost_share(_team_id uuid, _comp date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH c AS (
    SELECT t.cost_type, (SELECT x.monthly_amount FROM finance_team_costs x WHERE x.team_id = _team_id AND x.cost_type = t.cost_type
      AND x.valid_from <= date_trunc('month', _comp)::date ORDER BY x.valid_from DESC LIMIT 1) amt
    FROM (VALUES ('fixa'),('operacional'),('administrativa')) t(cost_type)
  ), ap AS (
    SELECT p.id, p.name FROM projects p WHERE p.team_id = _team_id AND p.finance_enabled
      AND public._project_active_in_month(p.id, date_trunc('month', _comp)::date)
  )
  SELECT jsonb_build_object(
    'configured', EXISTS (SELECT 1 FROM c WHERE amt IS NOT NULL),
    'active_projects', (SELECT count(*) FROM ap),
    'projects', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY name) FROM ap), '[]'::jsonb),
    'fixa', coalesce((SELECT amt FROM c WHERE cost_type = 'fixa'), 0),
    'operacional', coalesce((SELECT amt FROM c WHERE cost_type = 'operacional'), 0),
    'administrativa', coalesce((SELECT amt FROM c WHERE cost_type = 'administrativa'), 0))
$$;
REVOKE ALL ON FUNCTION public._finance_team_cost_share(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_team_cost_share(_team_id uuid, _competence date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_finance_permission((select auth.uid()), 'finance.view_team', _team_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN public._finance_team_cost_share(_team_id, _competence);
END $$;
REVOKE ALL ON FUNCTION public.get_team_cost_share(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_cost_share(uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public._finance_project_month_live(_project_id uuid, _competence date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _comp date := date_trunc('month', _competence)::date;
  _end date := (date_trunc('month', _competence) + interval '1 month - 1 day')::date;
  _p record; _ct numeric; _cm numeric; _pt numeric; _pv numeric; _pm numeric;
  _boards uuid[]; _gross numeric; _tax numeric; _direct numeric; _fixa numeric; _oper numeric; _adm numeric;
  _hours numeric; _cost numeric; _miss_h numeric; _miss_p int; _status text; _tax_rate numeric; _target numeric; _var numeric;
  _share jsonb; _n int; _active boolean;
BEGIN
  SELECT id, team_id, name, finance_enabled, unit_external_id, integration_key INTO _p FROM projects WHERE id = _project_id;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT tax_rate, margin_target INTO _ct, _cm FROM finance_settings WHERE team_id = _p.team_id AND board_id IS NULL LIMIT 1;
  SELECT tax_rate, variable_rate, margin_target INTO _pt, _pv, _pm FROM finance_project_settings
    WHERE project_id = _project_id AND valid_from <= _comp ORDER BY valid_from DESC LIMIT 1;
  _tax_rate := coalesce(_pt, _ct, 0.21);
  _target := coalesce(_pm, _cm, 0.40);
  _var := coalesce(_pv, 0);

  SELECT coalesce(array_agg(DISTINCT board_id), '{}') INTO _boards FROM project_boards
    WHERE project_id = _project_id AND valid_from <= _end AND (valid_to IS NULL OR valid_to >= _comp);

  SELECT coalesce(sum(gross_amount), 0), coalesce(sum(gross_amount * coalesce(tax_rate, _tax_rate)), 0) INTO _gross, _tax
    FROM finance_revenues WHERE team_id = _p.team_id AND date_trunc('month', competence)::date = _comp
      AND (project_id = _project_id OR (project_id IS NULL AND board_id = ANY(_boards)));
  SELECT coalesce(sum(amount), 0) INTO _direct FROM finance_expenses
    WHERE team_id = _p.team_id AND board_id = ANY(_boards) AND date_trunc('month', competence)::date = _comp;

  _share := public._finance_team_cost_share(_p.team_id, _comp);
  _active := public._project_active_in_month(_project_id, _comp);
  IF (_share->>'configured')::boolean THEN
    _n := (_share->>'active_projects')::int;
    IF _active AND _p.finance_enabled AND _n > 0 THEN
      _fixa := (_share->>'fixa')::numeric / _n; _oper := (_share->>'operacional')::numeric / _n; _adm := (_share->>'administrativa')::numeric / _n;
    ELSE _fixa := 0; _oper := 0; _adm := 0; END IF;
  ELSE
    SELECT coalesce(sum(al.amount) FILTER (WHERE e.expense_type = 'fixa'), 0),
           coalesce(sum(al.amount) FILTER (WHERE e.expense_type = 'operacional'), 0),
           coalesce(sum(al.amount) FILTER (WHERE e.expense_type NOT IN ('fixa','operacional')), 0)
      INTO _fixa, _oper, _adm
      FROM _finance_allocations(_p.team_id, _comp, _comp) al JOIN finance_expenses e ON e.id = al.expense_id
      WHERE al.board_id = ANY(_boards);
  END IF;

  WITH s AS (
    SELECT sl.user_id, sum(sl.hours) h FROM _finance_time_slices(_p.team_id, _comp) sl
    JOIN finance_demand_attributions a ON a.demand_id = sl.demand_id AND a.competence = _comp AND a.project_id = _project_id
    GROUP BY sl.user_id
  ), c AS (
    SELECT s.user_id, s.h, (SELECT CASE WHEN x.productive_hours > 0 THEN x.monthly_cost / x.productive_hours END
      FROM public._finance_member_cost(_p.team_id, s.user_id, _comp) x LIMIT 1) hr
    FROM s
  )
  SELECT coalesce(sum(h), 0), coalesce(sum(h * hr), 0), coalesce(sum(h) FILTER (WHERE hr IS NULL), 0), count(*) FILTER (WHERE hr IS NULL)
    INTO _hours, _cost, _miss_h, _miss_p FROM c;

  SELECT status INTO _status FROM finance_periods WHERE team_id = _p.team_id AND competence = _comp;

  RETURN jsonb_build_object(
    'project_id', _p.id, 'project_name', _p.name, 'team_id', _p.team_id,
    'unit_external_id', _p.unit_external_id, 'integration_key', _p.integration_key, 'finance_enabled', _p.finance_enabled,
    'competence', _comp, 'period_status', coalesce(_status, 'open'), 'board_ids', to_jsonb(_boards),
    'tax_rate', _tax_rate, 'variable_rate', _var, 'margin_target', _target,
    'gross', round(_gross, 2), 'tax', round(_tax, 2), 'variable_costs', round(_gross * _var, 2),
    'direct_expenses', round(_direct, 2), 'alloc_fixed', round(_fixa, 2), 'alloc_operational', round(_oper, 2), 'alloc_admin', round(_adm, 2),
    'active_in_month', _active, 'active_projects', (_share->>'active_projects')::int, 'cost_share_mode', CASE WHEN (_share->>'configured')::boolean THEN 'active_projects' ELSE 'legacy' END,
    'team_cost', round(_cost, 2), 'hours', round(_hours, 2), 'hours_without_cost', round(_miss_h, 2), 'people_without_cost', _miss_p);
END $function$;

-- Board is frozen when it belongs to at least one current project and all of them are inactive.
CREATE OR REPLACE FUNCTION public.is_board_frozen(_board_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM project_boards pb JOIN projects p ON p.id = pb.project_id WHERE pb.board_id = _board_id AND pb.valid_to IS NULL)
    AND NOT EXISTS (SELECT 1 FROM project_boards pb JOIN projects p ON p.id = pb.project_id WHERE pb.board_id = _board_id AND pb.valid_to IS NULL AND p.status = 'active')
$$;
REVOKE ALL ON FUNCTION public.is_board_frozen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_board_frozen(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_board_frozen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _b uuid;
BEGIN
  IF TG_TABLE_NAME = 'demands' THEN
    IF TG_OP = 'UPDATE' AND NEW.status_id IS NOT DISTINCT FROM OLD.status_id THEN RETURN NEW; END IF;
    _b := NEW.board_id;
  ELSIF TG_TABLE_NAME = 'demand_requests' THEN
    _b := NEW.board_id;
  ELSIF TG_TABLE_NAME = 'demand_time_entries' THEN
    IF TG_OP = 'UPDATE' AND NEW.started_at IS NOT DISTINCT FROM OLD.started_at THEN RETURN NEW; END IF;
    SELECT board_id INTO _b FROM demands WHERE id = NEW.demand_id;
  END IF;
  IF _b IS NOT NULL AND public.is_board_frozen(_b) THEN
    RAISE EXCEPTION 'BOARD_FROZEN: o projeto deste quadro está inativo' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_demands_board_frozen BEFORE INSERT OR UPDATE ON public.demands FOR EACH ROW EXECUTE FUNCTION public.guard_board_frozen();
CREATE TRIGGER trg_demand_requests_board_frozen BEFORE INSERT ON public.demand_requests FOR EACH ROW EXECUTE FUNCTION public.guard_board_frozen();
CREATE TRIGGER trg_time_entries_board_frozen BEFORE INSERT OR UPDATE ON public.demand_time_entries FOR EACH ROW EXECUTE FUNCTION public.guard_board_frozen();

CREATE OR REPLACE FUNCTION public.set_project_status(_project_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := (select auth.uid()); _team uuid; _cur text;
BEGIN
  IF _status NOT IN ('active','inactive') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  SELECT team_id, status INTO _team, _cur FROM projects WHERE id = _project_id;
  IF _team IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT public.has_module_permission(_uid, _team, 'projects.edit', _project_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _cur = _status THEN RETURN; END IF;
  IF _status = 'inactive' THEN
    -- stop running timers on boards that will freeze
    UPDATE demand_time_entries t SET ended_at = now()
      FROM demands d WHERE d.id = t.demand_id AND t.ended_at IS NULL
        AND d.board_id IN (SELECT board_id FROM project_boards WHERE project_id = _project_id AND valid_to IS NULL)
        AND NOT EXISTS (SELECT 1 FROM project_boards pb JOIN projects p ON p.id = pb.project_id
          WHERE pb.board_id = d.board_id AND pb.valid_to IS NULL AND p.id <> _project_id AND p.status = 'active');
  END IF;
  UPDATE projects SET status = _status, updated_at = now() WHERE id = _project_id;
  INSERT INTO project_status_history(project_id, status, changed_by) VALUES (_project_id, _status, _uid);
END $$;
REVOKE ALL ON FUNCTION public.set_project_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_project_status(uuid, text) TO authenticated;