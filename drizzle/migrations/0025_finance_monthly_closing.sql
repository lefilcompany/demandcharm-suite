-- Phase 4: monthly closing
ALTER TABLE public.finance_permissions DROP CONSTRAINT IF EXISTS finance_permissions_permission_check;
ALTER TABLE public.finance_permissions ADD CONSTRAINT finance_permissions_permission_check CHECK (permission IN ('finance.view_team','finance.view_board','finance.view_project','finance.view_cost_details','finance.view_employee_costs','finance.manage_revenue','finance.manage_expenses','finance.manage_allocations','finance.manage_settings','finance.export','finance.close_period'));

CREATE TABLE public.finance_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  competence date NOT NULL,
  status text NOT NULL DEFAULT 'closed' CHECK (status IN ('closed')),
  rules_version integer NOT NULL DEFAULT 1,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  closed_by uuid NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, competence),
  CHECK (competence = date_trunc('month', competence)::date)
);

CREATE TABLE public.finance_period_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.finance_periods(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  board_name text NOT NULL,
  competence date NOT NULL,
  gross numeric NOT NULL DEFAULT 0, tax numeric NOT NULL DEFAULT 0,
  direct_expenses numeric NOT NULL DEFAULT 0, allocated_expenses numeric NOT NULL DEFAULT 0,
  team_cost numeric NOT NULL DEFAULT 0, hours_realized numeric NOT NULL DEFAULT 0,
  hours_planned numeric NOT NULL DEFAULT 0, hours_without_cost numeric NOT NULL DEFAULT 0,
  margin_target numeric NOT NULL DEFAULT 0.40,
  allocations jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (period_id, board_id)
);

CREATE TABLE public.finance_period_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.finance_periods(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  target text NOT NULL CHECK (target IN ('gross','tax','direct_expenses','allocated_expenses','team_cost')),
  amount numeric NOT NULL CHECK (amount <> 0),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX finance_period_adjustments_period ON public.finance_period_adjustments(period_id, board_id);

GRANT SELECT ON public.finance_periods, public.finance_period_snapshots, public.finance_period_adjustments TO authenticated;
GRANT ALL ON public.finance_periods, public.finance_period_snapshots, public.finance_period_adjustments TO service_role;
ALTER TABLE public.finance_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_period_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_period_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance periods visible to finance viewers" ON public.finance_periods FOR SELECT TO authenticated
  USING (public.has_finance_permission((select auth.uid()), 'finance.view_team', team_id, NULL)
      OR public.has_finance_permission((select auth.uid()), 'finance.close_period', team_id, NULL)
      OR EXISTS (SELECT 1 FROM public.finance_permissions fp WHERE fp.user_id = (select auth.uid()) AND fp.team_id = finance_periods.team_id AND fp.permission = 'finance.view_board' AND fp.revoked_at IS NULL));
CREATE POLICY "finance snapshots visible per board" ON public.finance_period_snapshots FOR SELECT TO authenticated
  USING (public.can_view_finance_board((select auth.uid()), team_id, board_id));
CREATE POLICY "finance adjustments visible per board" ON public.finance_period_adjustments FOR SELECT TO authenticated
  USING (public.can_view_finance_board((select auth.uid()), team_id, board_id));

-- Viewer-independent live overview (all team boards). Internal only.
CREATE OR REPLACE FUNCTION public._finance_overview_all(_team_id uuid, _from date, _to date)
 RETURNS TABLE(board_id uuid, board_name text, competence date, gross numeric, tax numeric, direct_expenses numeric, allocated_expenses numeric, team_cost numeric, hours_realized numeric, hours_planned numeric, hours_without_cost numeric, margin_target numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH months AS (SELECT generate_series(date_trunc('month', _from)::date, date_trunc('month', _to)::date, interval '1 month')::date AS m),
  bs AS (SELECT b.id, b.name FROM public.boards b WHERE b.team_id = _team_id),
  team_cfg AS (SELECT tax_rate, margin_target FROM public.finance_settings WHERE team_id = _team_id AND board_id IS NULL),
  rev AS (
    SELECT r.board_id, date_trunc('month', r.competence)::date m, sum(r.gross_amount) gross,
      sum(r.gross_amount * COALESCE(r.tax_rate, bc.tax_rate, (SELECT tax_rate FROM team_cfg), 0.21)) tax
    FROM public.finance_revenues r
    LEFT JOIN public.finance_settings bc ON bc.team_id = r.team_id AND bc.board_id = r.board_id
    WHERE r.team_id = _team_id AND r.board_id IN (SELECT id FROM bs) AND r.competence BETWEEN date_trunc('month', _from)::date AND _to
    GROUP BY 1, 2
  ),
  exp AS (
    SELECT e.board_id, date_trunc('month', e.competence)::date m, sum(e.amount) amt
    FROM public.finance_expenses e
    WHERE e.team_id = _team_id AND e.board_id IN (SELECT id FROM bs) AND e.competence BETWEEN date_trunc('month', _from)::date AND _to
    GROUP BY 1, 2
  ),
  alloc AS (
    SELECT a.board_id, a.competence m, sum(a.amount) amt FROM public._finance_allocations(_team_id, _from, _to) a GROUP BY 1, 2
  ),
  hrs AS (
    SELECT d.board_id, date_trunc('month', t.started_at)::date m, t.user_id, sum(COALESCE(t.duration_seconds, 0)) / 3600.0 h
    FROM public.demand_time_entries t JOIN public.demands d ON d.id = t.demand_id
    WHERE d.board_id IN (SELECT id FROM bs) AND t.started_at >= date_trunc('month', _from) AND t.started_at < (date_trunc('month', _to) + interval '1 month')
    GROUP BY 1, 2, 3
  ),
  cost AS (
    SELECT h.board_id, h.m, sum(h.h) h_total,
      sum(CASE WHEN c.id IS NOT NULL AND c.productive_hours > 0 THEN h.h * c.monthly_cost / c.productive_hours ELSE 0 END) cost,
      sum(CASE WHEN c.id IS NULL THEN h.h ELSE 0 END) h_missing
    FROM hrs h LEFT JOIN public.finance_employee_costs c ON c.team_id = _team_id AND c.user_id = h.user_id AND c.competence = h.m
    GROUP BY 1, 2
  ),
  plan AS (
    SELECT d.board_id, date_trunc('month', d.created_at)::date m, sum(COALESCE(s.estimated_hours, s.hours_max, 0)) h
    FROM public.demands d JOIN public.services s ON s.id = d.service_id
    WHERE d.board_id IN (SELECT id FROM bs) AND d.archived = false
      AND d.created_at >= date_trunc('month', _from) AND d.created_at < (date_trunc('month', _to) + interval '1 month')
    GROUP BY 1, 2
  )
  SELECT bs.id, bs.name, months.m,
    COALESCE(rev.gross, 0), COALESCE(rev.tax, 0), COALESCE(exp.amt, 0), COALESCE(alloc.amt, 0),
    COALESCE(cost.cost, 0), COALESCE(cost.h_total, 0), COALESCE(plan.h, 0), COALESCE(cost.h_missing, 0),
    COALESCE((SELECT margin_target FROM public.finance_settings fs WHERE fs.team_id = _team_id AND fs.board_id = bs.id),
             (SELECT margin_target FROM team_cfg), 0.40)
  FROM bs CROSS JOIN months
  LEFT JOIN rev ON rev.board_id = bs.id AND rev.m = months.m
  LEFT JOIN exp ON exp.board_id = bs.id AND exp.m = months.m
  LEFT JOIN alloc ON alloc.board_id = bs.id AND alloc.m = months.m
  LEFT JOIN cost ON cost.board_id = bs.id AND cost.m = months.m
  LEFT JOIN plan ON plan.board_id = bs.id AND plan.m = months.m
$function$;
REVOKE ALL ON FUNCTION public._finance_overview_all(uuid, date, date) FROM PUBLIC, anon, authenticated;

-- Overview: open months read live; closed months read the snapshot plus audited adjustments.
CREATE OR REPLACE FUNCTION public.get_finance_overview(_team_id uuid, _from date, _to date)
 RETURNS TABLE(board_id uuid, board_name text, competence date, gross numeric, tax numeric, direct_expenses numeric, allocated_expenses numeric, team_cost numeric, hours_realized numeric, hours_planned numeric, hours_without_cost numeric, margin_target numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() AS uid),
  closed AS (SELECT p.id, p.competence FROM public.finance_periods p
    WHERE p.team_id = _team_id AND p.competence BETWEEN date_trunc('month', _from)::date AND _to),
  live AS (
    SELECT o.* FROM public._finance_overview_all(_team_id, _from, _to) o, me
    WHERE public.can_view_finance_board(me.uid, _team_id, o.board_id)
      AND NOT EXISTS (SELECT 1 FROM closed c WHERE c.competence = o.competence)
  ),
  adj AS (
    SELECT a.period_id, a.board_id,
      sum(a.amount) FILTER (WHERE a.target = 'gross') g, sum(a.amount) FILTER (WHERE a.target = 'tax') t,
      sum(a.amount) FILTER (WHERE a.target = 'direct_expenses') d, sum(a.amount) FILTER (WHERE a.target = 'allocated_expenses') al,
      sum(a.amount) FILTER (WHERE a.target = 'team_cost') tc
    FROM public.finance_period_adjustments a WHERE a.period_id IN (SELECT id FROM closed) GROUP BY 1, 2
  ),
  snap AS (
    SELECT s.board_id, s.board_name, s.competence,
      s.gross + COALESCE(adj.g, 0), s.tax + COALESCE(adj.t, 0), s.direct_expenses + COALESCE(adj.d, 0),
      s.allocated_expenses + COALESCE(adj.al, 0), s.team_cost + COALESCE(adj.tc, 0),
      s.hours_realized, s.hours_planned, s.hours_without_cost, s.margin_target
    FROM public.finance_period_snapshots s JOIN closed c ON c.id = s.period_id
    LEFT JOIN adj ON adj.period_id = s.period_id AND adj.board_id = s.board_id, me
    WHERE public.can_view_finance_board(me.uid, _team_id, s.board_id)
  )
  SELECT * FROM live UNION ALL SELECT * FROM snap
$function$;
REVOKE ALL ON FUNCTION public.get_finance_overview(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_finance_overview(uuid, date, date) TO authenticated;

-- Checklist (internal, viewer-independent)
CREATE OR REPLACE FUNCTION public._finance_close_checklist(_team_id uuid, _month date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m date := date_trunc('month', _month)::date; e date := (date_trunc('month', _month) + interval '1 month - 1 day')::date;
  _running int; _uncls int; _norev int; _nocost int; _nocost_h numeric; _badscope int; _unalloc_n int; _unalloc numeric;
  _exp_total numeric; _exp_dist numeric; _noincome int;
BEGIN
  SELECT count(*) INTO _running FROM public.demand_time_entries t JOIN public.demands d ON d.id = t.demand_id JOIN public.boards b ON b.id = d.board_id
    WHERE b.team_id = _team_id AND t.ended_at IS NULL AND t.started_at < e + 1;
  SELECT count(*) INTO _uncls FROM public.finance_expenses x WHERE x.team_id = _team_id AND x.competence BETWEEN m AND e
    AND (coalesce(btrim(x.category), '') = '' OR coalesce(btrim(x.description), '') = '');
  SELECT count(*) INTO _norev FROM public.finance_revenues r WHERE r.team_id = _team_id AND r.competence BETWEEN m AND e AND r.gross_amount = 0;
  SELECT count(DISTINCT t.user_id), coalesce(sum(t.duration_seconds), 0) / 3600.0 INTO _nocost, _nocost_h
    FROM public.demand_time_entries t JOIN public.demands d ON d.id = t.demand_id JOIN public.boards b ON b.id = d.board_id
    WHERE b.team_id = _team_id AND t.started_at >= m AND t.started_at < e + 1
      AND NOT EXISTS (SELECT 1 FROM public.finance_employee_costs c WHERE c.team_id = _team_id AND c.user_id = t.user_id AND c.competence = m AND c.productive_hours > 0);
  SELECT count(*) INTO _badscope FROM public.finance_expenses x WHERE x.team_id = _team_id AND x.board_id IS NULL AND x.competence BETWEEN m AND e
    AND x.allocation_board_ids IS NOT NULL AND (cardinality(x.allocation_board_ids) = 0 OR EXISTS (
      SELECT 1 FROM unnest(x.allocation_board_ids) bid WHERE NOT EXISTS (SELECT 1 FROM public.boards b WHERE b.id = bid AND b.team_id = _team_id)));
  WITH a AS (SELECT expense_id, sum(amount) s FROM public._finance_allocations(_team_id, m, e) GROUP BY 1)
  SELECT count(*), coalesce(sum(x.amount - coalesce(a.s, 0)), 0) INTO _unalloc_n, _unalloc
    FROM public.finance_expenses x LEFT JOIN a ON a.expense_id = x.id
    WHERE x.team_id = _team_id AND x.board_id IS NULL AND x.competence BETWEEN m AND e AND x.amount - coalesce(a.s, 0) > 0.004;
  SELECT coalesce(sum(amount), 0) INTO _exp_total FROM public.finance_expenses WHERE team_id = _team_id AND competence BETWEEN m AND e;
  SELECT coalesce(sum(direct_expenses + allocated_expenses), 0), count(*) FILTER (WHERE gross = 0 AND (team_cost + direct_expenses + allocated_expenses) > 0)
    INTO _exp_dist, _noincome FROM public._finance_overview_all(_team_id, m, e);
  RETURN jsonb_build_array(
    jsonb_build_object('code','running_timers','severity','block','count',_running,'amount',null),
    jsonb_build_object('code','unclassified_expenses','severity','block','count',_uncls,'amount',null),
    jsonb_build_object('code','revenue_without_value','severity','warn','count',_norev,'amount',null),
    jsonb_build_object('code','hours_without_cost','severity','block','count',_nocost,'amount',round(_nocost_h, 2)),
    jsonb_build_object('code','incomplete_allocations','severity','block','count',_badscope,'amount',null),
    jsonb_build_object('code','unallocated_amount','severity','block','count',_unalloc_n,'amount',round(_unalloc, 2)),
    jsonb_build_object('code','totals_mismatch','severity','block','count',CASE WHEN abs(_exp_total - _unalloc - _exp_dist) > 0.01 THEN 1 ELSE 0 END,'amount',round(_exp_total - _unalloc - _exp_dist, 2)),
    jsonb_build_object('code','boards_without_revenue','severity','warn','count',_noincome,'amount',null)
  );
END $$;
REVOKE ALL ON FUNCTION public._finance_close_checklist(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.finance_close_preview(_team_id uuid, _month date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m date := date_trunc('month', _month)::date; e date := (date_trunc('month', _month) + interval '1 month - 1 day')::date;
BEGIN
  IF NOT public.has_finance_permission(auth.uid(), 'finance.close_period', _team_id, NULL) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN jsonb_build_object(
    'checklist', public._finance_close_checklist(_team_id, m),
    'period', (SELECT to_jsonb(p) FROM public.finance_periods p WHERE p.team_id = _team_id AND p.competence = m),
    'rows', COALESCE((SELECT jsonb_agg(to_jsonb(o)) FROM public._finance_overview_all(_team_id, m, e) o), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.finance_close_preview(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_close_preview(uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_close_period(_team_id uuid, _month date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _me uuid := auth.uid(); m date := date_trunc('month', _month)::date; e date := (date_trunc('month', _month) + interval '1 month - 1 day')::date;
  _chk jsonb; _id uuid; _totals jsonb;
BEGIN
  IF NOT public.has_finance_permission(_me, 'finance.close_period', _team_id, NULL) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF m >= date_trunc('month', now())::date THEN RAISE EXCEPTION 'PERIOD_NOT_ENDED'; END IF;
  IF EXISTS (SELECT 1 FROM public.finance_periods WHERE team_id = _team_id AND competence = m) THEN RAISE EXCEPTION 'PERIOD_ALREADY_CLOSED'; END IF;
  _chk := public._finance_close_checklist(_team_id, m);
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_chk) i WHERE i->>'severity' = 'block' AND (i->>'count')::int > 0) THEN
    RAISE EXCEPTION 'CHECKLIST_BLOCKED';
  END IF;
  SELECT jsonb_build_object('gross', sum(gross), 'tax', sum(tax), 'direct_expenses', sum(direct_expenses), 'allocated_expenses', sum(allocated_expenses), 'team_cost', sum(team_cost), 'hours_realized', sum(hours_realized))
    INTO _totals FROM public._finance_overview_all(_team_id, m, e);
  INSERT INTO public.finance_periods(team_id, competence, settings, checklist, totals, closed_by)
  VALUES (_team_id, m,
    jsonb_build_object('settings', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM public.finance_settings s WHERE s.team_id = _team_id), '[]'::jsonb),
      'expenses', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'board_id', x.board_id, 'amount', x.amount, 'allocation_method', x.allocation_method, 'hours_weight', x.hours_weight, 'allocation_board_ids', x.allocation_board_ids))
        FROM public.finance_expenses x WHERE x.team_id = _team_id AND x.competence BETWEEN m AND e), '[]'::jsonb)),
    _chk, _totals, _me) RETURNING id INTO _id;
  INSERT INTO public.finance_period_snapshots(period_id, team_id, board_id, board_name, competence, gross, tax, direct_expenses, allocated_expenses, team_cost, hours_realized, hours_planned, hours_without_cost, margin_target, allocations)
  SELECT _id, _team_id, o.board_id, o.board_name, m, o.gross, o.tax, o.direct_expenses, o.allocated_expenses, o.team_cost, o.hours_realized, o.hours_planned, o.hours_without_cost, o.margin_target,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('expense_id', a.expense_id, 'amount', a.amount, 'share', a.share)) FROM public._finance_allocations(_team_id, m, e) a WHERE a.board_id = o.board_id), '[]'::jsonb)
  FROM public._finance_overview_all(_team_id, m, e) o;
  INSERT INTO public.finance_audit_log(team_id, actor_id, action, entity, entity_id, after_data)
  VALUES (_team_id, _me, 'close', 'finance_periods', _id, jsonb_build_object('competence', m, 'totals', _totals));
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.finance_close_period(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_close_period(uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_add_adjustment(_period_id uuid, _board_id uuid, _target text, _amount numeric, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _me uuid := auth.uid(); _p public.finance_periods; _id uuid; _perm text;
BEGIN
  SELECT * INTO _p FROM public.finance_periods WHERE id = _period_id;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  _perm := CASE WHEN _target IN ('gross','tax') THEN 'finance.manage_revenue' ELSE 'finance.manage_expenses' END;
  IF NOT (public.has_finance_permission(_me, _perm, _p.team_id, _board_id) AND public.can_view_finance_board(_me, _p.team_id, _board_id)) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.finance_period_snapshots WHERE period_id = _period_id AND board_id = _board_id) THEN RAISE EXCEPTION 'BOARD_NOT_IN_PERIOD'; END IF;
  INSERT INTO public.finance_period_adjustments(period_id, team_id, board_id, target, amount, reason, created_by)
  VALUES (_period_id, _p.team_id, _board_id, _target, round(_amount, 2), btrim(_reason), _me) RETURNING id INTO _id;
  INSERT INTO public.finance_audit_log(team_id, actor_id, action, entity, entity_id, after_data)
  VALUES (_p.team_id, _me, 'adjust', 'finance_period_adjustments', _id, jsonb_build_object('period', _p.competence, 'board_id', _board_id, 'target', _target, 'amount', _amount, 'reason', _reason));
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.finance_add_adjustment(uuid, uuid, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_add_adjustment(uuid, uuid, text, numeric, text) TO authenticated;

-- Lock entries of closed months (cascading team/board deletions still pass)
CREATE OR REPLACE FUNCTION public.finance_guard_closed_period()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _row record := COALESCE(NEW, OLD);
BEGIN
  IF TG_OP = 'DELETE' AND (NOT EXISTS (SELECT 1 FROM public.teams WHERE id = OLD.team_id)
      OR (TG_TABLE_NAME <> 'finance_employee_costs' AND (to_jsonb(OLD)->>'board_id') IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.boards WHERE id = (to_jsonb(OLD)->>'board_id')::uuid))) THEN
    RETURN OLD;
  END IF;
  IF TG_OP <> 'INSERT' AND EXISTS (SELECT 1 FROM public.finance_periods p WHERE p.team_id = OLD.team_id AND p.competence = date_trunc('month', OLD.competence)::date) THEN
    RAISE EXCEPTION 'PERIOD_CLOSED' USING HINT = 'Use um ajuste no fechamento para corrigir este mês.';
  END IF;
  IF TG_OP <> 'DELETE' AND EXISTS (SELECT 1 FROM public.finance_periods p WHERE p.team_id = NEW.team_id AND p.competence = date_trunc('month', NEW.competence)::date) THEN
    RAISE EXCEPTION 'PERIOD_CLOSED' USING HINT = 'Use um ajuste no fechamento para corrigir este mês.';
  END IF;
  RETURN _row;
END $$;
REVOKE ALL ON FUNCTION public.finance_guard_closed_period() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_finance_guard_closed BEFORE INSERT OR UPDATE OR DELETE ON public.finance_revenues FOR EACH ROW EXECUTE FUNCTION public.finance_guard_closed_period();
CREATE TRIGGER trg_finance_guard_closed BEFORE INSERT OR UPDATE OR DELETE ON public.finance_expenses FOR EACH ROW EXECUTE FUNCTION public.finance_guard_closed_period();
CREATE TRIGGER trg_finance_guard_closed BEFORE INSERT OR UPDATE OR DELETE ON public.finance_employee_costs FOR EACH ROW EXECUTE FUNCTION public.finance_guard_closed_period();