CREATE TABLE public.finance_member_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  monthly_cost numeric NOT NULL CHECK (monthly_cost >= 0),
  productive_hours numeric NOT NULL CHECK (productive_hours > 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
CREATE INDEX finance_member_rates_team ON public.finance_member_rates(team_id, user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_member_rates TO authenticated;
GRANT ALL ON public.finance_member_rates TO service_role;
ALTER TABLE public.finance_member_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fmr_select" ON public.finance_member_rates FOR SELECT TO authenticated
  USING (public.has_finance_permission((select auth.uid()), 'finance.view_employee_costs', team_id, NULL));
CREATE POLICY "fmr_write" ON public.finance_member_rates FOR ALL TO authenticated
  USING (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL))
  WITH CHECK (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL));
CREATE TRIGGER trg_finance_member_rates_audit AFTER INSERT OR UPDATE OR DELETE ON public.finance_member_rates
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();

INSERT INTO public.finance_member_rates (team_id, user_id, monthly_cost, productive_hours, created_by, created_at, updated_at)
SELECT DISTINCT ON (c.team_id, c.user_id) c.team_id, c.user_id, c.monthly_cost, c.productive_hours, c.created_by, c.created_at, c.updated_at
FROM public.finance_employee_costs c
ORDER BY c.team_id, c.user_id, c.competence DESC
ON CONFLICT (team_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public._finance_member_cost(_team_id uuid, _user_id uuid, _month date)
 RETURNS TABLE(monthly_cost numeric, productive_hours numeric)
 LANGUAGE sql STABLE
 SET search_path TO 'public'
AS $function$
  WITH m AS (SELECT date_trunc('month', _month)::date AS m),
  closed AS (SELECT 1 FROM public.finance_periods p, m WHERE p.team_id = _team_id AND p.competence = m.m AND p.status = 'closed'),
  rec AS (SELECT c.monthly_cost, c.productive_hours FROM public.finance_employee_costs c, m
            WHERE c.team_id = _team_id AND c.user_id = _user_id AND c.competence = m.m AND c.productive_hours > 0),
  rate AS (SELECT r.monthly_cost, r.productive_hours FROM public.finance_member_rates r
            WHERE r.team_id = _team_id AND r.user_id = _user_id AND r.productive_hours > 0)
  SELECT monthly_cost, productive_hours FROM (
    SELECT 1 AS ord, rec.monthly_cost, rec.productive_hours FROM rec WHERE EXISTS (SELECT 1 FROM closed)
    UNION ALL
    SELECT 2, rate.monthly_cost, rate.productive_hours FROM rate WHERE NOT EXISTS (SELECT 1 FROM closed)
    UNION ALL
    SELECT 3, rec.monthly_cost, rec.productive_hours FROM rec
      WHERE NOT EXISTS (SELECT 1 FROM closed) AND NOT EXISTS (SELECT 1 FROM rate)
  ) t ORDER BY ord LIMIT 1;
$function$;
REVOKE EXECUTE ON FUNCTION public._finance_member_cost(uuid, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._finance_member_cost(uuid, uuid, date) TO authenticated;
COMMENT ON TABLE public.finance_member_rates IS 'Configuracao global de custo/hora por pessoa; vale ate ser trocada';

CREATE OR REPLACE FUNCTION public._finance_overview_all(_team_id uuid, _from date, _to date)
 RETURNS TABLE(board_id uuid, board_name text, competence date, gross numeric, tax numeric, direct_expenses numeric, allocated_expenses numeric, team_cost numeric, hours_realized numeric, hours_planned numeric, hours_without_cost numeric, margin_target numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    SELECT d.board_id, public._sp_month(t.started_at) m, t.user_id, sum(COALESCE(t.duration_seconds, 0)) / 3600.0 h
    FROM public.demand_time_entries t JOIN public.demands d ON d.id = t.demand_id
    WHERE d.board_id IN (SELECT id FROM bs) AND t.started_at >= public._sp_month_start(_from) AND t.started_at < public._sp_month_start((date_trunc('month', _to) + interval '1 month')::date)
    GROUP BY 1, 2, 3
  ),
  cost AS (
    SELECT h.board_id, h.m, sum(h.h) h_total,
      sum(CASE WHEN mc.monthly_cost IS NOT NULL THEN h.h * mc.monthly_cost / mc.productive_hours ELSE 0 END) cost,
      sum(CASE WHEN mc.monthly_cost IS NULL THEN h.h ELSE 0 END) h_missing
    FROM hrs h LEFT JOIN LATERAL public._finance_member_cost(_team_id, h.user_id, h.m) mc ON true
    GROUP BY 1, 2
  ),
  plan AS (
    SELECT d.board_id, public._sp_month(d.created_at) m, sum(COALESCE(s.estimated_hours, s.hours_max, 0)) h
    FROM public.demands d JOIN public.services s ON s.id = d.service_id
    WHERE d.board_id IN (SELECT id FROM bs) AND d.archived = false
      AND d.created_at >= public._sp_month_start(_from) AND d.created_at < public._sp_month_start((date_trunc('month', _to) + interval '1 month')::date)
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

CREATE OR REPLACE FUNCTION public.get_finance_people(_team_id uuid, _from date, _to date)
 RETURNS TABLE(user_id uuid, full_name text, competence date, monthly_cost numeric, productive_hours numeric, board_id uuid, board_name text, hours numeric, cost numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() uid),
  detail AS (SELECT public.has_finance_permission(me.uid, 'finance.view_employee_costs', _team_id) ok FROM me),
  months AS (SELECT generate_series(date_trunc('month', _from)::date, date_trunc('month', _to)::date, interval '1 month')::date AS m),
  bs AS (SELECT b.id, b.name FROM public.boards b, me WHERE b.team_id = _team_id AND public.can_view_finance_board(me.uid, _team_id, b.id)),
  hrs AS (
    SELECT t.user_id, d.board_id, public._sp_month(t.started_at) m, sum(COALESCE(t.duration_seconds,0))/3600.0 h
    FROM public.demand_time_entries t JOIN public.demands d ON d.id = t.demand_id
    WHERE d.board_id IN (SELECT id FROM bs) AND t.started_at >= public._sp_month_start(_from) AND t.started_at < public._sp_month_start((date_trunc('month', _to) + interval '1 month')::date)
    GROUP BY 1,2,3
  ),
  priced AS (
    SELECT h.*, mc.monthly_cost, mc.productive_hours,
      CASE WHEN mc.productive_hours > 0 THEN h.h * mc.monthly_cost / mc.productive_hours END cost
    FROM hrs h LEFT JOIN LATERAL public._finance_member_cost(_team_id, h.user_id, h.m) mc ON true
  )
  SELECT p.user_id, pr.full_name, p.m, p.monthly_cost, p.productive_hours, p.board_id, bs.name, p.h, p.cost
  FROM priced p JOIN bs ON bs.id = p.board_id LEFT JOIN public.profiles pr ON pr.id = p.user_id, detail WHERE detail.ok
  UNION ALL
  SELECT c.user_id, pr.full_name, c.competence, c.monthly_cost, c.productive_hours, NULL, NULL, 0, NULL
  FROM public.finance_employee_costs c JOIN months ON months.m = c.competence LEFT JOIN public.profiles pr ON pr.id = c.user_id, detail
  WHERE detail.ok AND c.team_id = _team_id AND NOT EXISTS (SELECT 1 FROM hrs WHERE hrs.user_id = c.user_id AND hrs.m = c.competence)
  UNION ALL
  SELECT NULL, NULL, p.m, NULL, NULL, p.board_id, bs.name, sum(p.h), sum(COALESCE(p.cost,0))
  FROM priced p JOIN bs ON bs.id = p.board_id, detail WHERE NOT detail.ok GROUP BY p.m, p.board_id, bs.name
$function$;

CREATE OR REPLACE FUNCTION public._finance_close_checklist(_team_id uuid, _month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE m date := date_trunc('month', _month)::date; e date := (date_trunc('month', _month) + interval '1 month - 1 day')::date;
  ts_from timestamptz := public._sp_month_start(date_trunc('month', _month)::date);
  ts_to timestamptz := public._sp_month_start((date_trunc('month', _month) + interval '1 month')::date);
  _running int; _uncls int; _norev int; _nocost int; _nocost_h numeric; _badscope int; _unalloc_n int; _unalloc numeric;
  _exp_total numeric; _exp_dist numeric; _surplus numeric; _noincome int;
  d_running jsonb; d_uncls jsonb; d_norev jsonb; d_nocost jsonb; d_badscope jsonb; d_unalloc jsonb; d_noincome jsonb;
BEGIN
  SELECT count(*), coalesce(jsonb_agg(jsonb_build_object('label', coalesce(p.full_name,'Colaborador'), 'detail', coalesce(d.title,'Demanda') || ' · ' || b.name, 'value', to_char(t.started_at AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI')) ORDER BY t.started_at), '[]')
    INTO _running, d_running
    FROM public.demand_time_entries t JOIN public.demands d ON d.id = t.demand_id JOIN public.boards b ON b.id = d.board_id
    LEFT JOIN public.profiles p ON p.id = t.user_id
    WHERE b.team_id = _team_id AND t.ended_at IS NULL AND t.started_at < ts_to;
  SELECT count(*), coalesce(jsonb_agg(jsonb_build_object('label', coalesce(nullif(btrim(x.description),''),'(sem descrição)'), 'detail', coalesce(nullif(btrim(x.category),''),'(sem categoria)'), 'value', x.amount::text, 'kind','money')), '[]')
    INTO _uncls, d_uncls FROM public.finance_expenses x WHERE x.team_id = _team_id AND x.competence BETWEEN m AND e
    AND (coalesce(btrim(x.category), '') = '' OR coalesce(btrim(x.description), '') = '');
  SELECT count(*), coalesce(jsonb_agg(jsonb_build_object('label', coalesce(b.name,'Sem quadro'), 'detail', to_char(r.competence,'MM/YYYY'), 'value', null)), '[]')
    INTO _norev, d_norev FROM public.finance_revenues r LEFT JOIN public.boards b ON b.id = r.board_id
    WHERE r.team_id = _team_id AND r.competence BETWEEN m AND e AND r.gross_amount = 0;
  WITH s AS (
    SELECT t.user_id, sum(coalesce(t.duration_seconds, 0)) / 3600.0 h
    FROM public.demand_time_entries t JOIN public.demands d ON d.id = t.demand_id JOIN public.boards b ON b.id = d.board_id
    WHERE b.team_id = _team_id AND t.started_at >= ts_from AND t.started_at < ts_to
      AND NOT EXISTS (SELECT 1 FROM public._finance_member_cost(_team_id, t.user_id, m) x WHERE x.monthly_cost IS NOT NULL)
    GROUP BY 1)
  SELECT count(*), coalesce(sum(s.h), 0),
    coalesce(jsonb_agg(jsonb_build_object('label', coalesce(p.full_name,'Colaborador'), 'detail', CASE WHEN tm.id IS NULL THEN 'fora da equipe' END,
      'value', round(coalesce(s.h,0), 2)::text, 'kind','hours', 'user_id', s.user_id, 'month', to_char(m, 'YYYY-MM')) ORDER BY s.h DESC), '[]')
    INTO _nocost, _nocost_h, d_nocost FROM s LEFT JOIN public.profiles p ON p.id = s.user_id
    LEFT JOIN public.team_members tm ON tm.team_id = _team_id AND tm.user_id = s.user_id;
  SELECT count(*), coalesce(jsonb_agg(jsonb_build_object('label', coalesce(nullif(btrim(x.description),''),'Despesa'), 'detail', 'Filtro de quadros vazio ou de fora da equipe', 'value', x.amount::text, 'kind','money')), '[]')
    INTO _badscope, d_badscope FROM public.finance_expenses x WHERE x.team_id = _team_id AND x.board_id IS NULL AND x.competence BETWEEN m AND e
    AND x.allocation_board_ids IS NOT NULL AND (cardinality(x.allocation_board_ids) = 0 OR EXISTS (
      SELECT 1 FROM unnest(x.allocation_board_ids) bid WHERE NOT EXISTS (SELECT 1 FROM public.boards b WHERE b.id = bid AND b.team_id = _team_id)));
  WITH a AS (SELECT expense_id, sum(amount) s FROM public._finance_allocations(_team_id, m, e) GROUP BY 1)
  SELECT count(*), coalesce(sum(x.amount - coalesce(a.s, 0)), 0),
    coalesce(jsonb_agg(jsonb_build_object('label', coalesce(nullif(btrim(x.description),''),'Despesa'), 'detail', 'Parte não distribuída', 'value', round(x.amount - coalesce(a.s,0), 2)::text, 'kind','money'))
      FILTER (WHERE x.amount - coalesce(a.s, 0) > 0.004), '[]')
    INTO _unalloc_n, _unalloc, d_unalloc
    FROM public.finance_expenses x LEFT JOIN a ON a.expense_id = x.id
    WHERE x.team_id = _team_id AND x.board_id IS NULL AND x.competence BETWEEN m AND e AND x.amount - coalesce(a.s, 0) > 0.004;
  WITH a AS (SELECT expense_id, sum(amount) s FROM public._finance_allocations(_team_id, m, e) GROUP BY 1)
  SELECT coalesce(sum(a.s - x.amount), 0) INTO _surplus
    FROM public.finance_expenses x JOIN a ON a.expense_id = x.id
    WHERE x.team_id = _team_id AND x.board_id IS NULL AND x.competence BETWEEN m AND e AND a.s - x.amount > 0.004;
  SELECT coalesce(sum(amount), 0) INTO _exp_total FROM public.finance_expenses WHERE team_id = _team_id AND competence BETWEEN m AND e;
  SELECT coalesce(sum(o.direct_expenses + o.allocated_expenses), 0), count(*) FILTER (WHERE o.gross = 0 AND (o.team_cost + o.direct_expenses + o.allocated_expenses) > 0),
    coalesce(jsonb_agg(jsonb_build_object('label', coalesce(b.name,'Quadro'), 'detail', 'Custo sem receita', 'value', round(o.team_cost + o.direct_expenses + o.allocated_expenses, 2)::text, 'kind','money'))
      FILTER (WHERE o.gross = 0 AND (o.team_cost + o.direct_expenses + o.allocated_expenses) > 0), '[]')
    INTO _exp_dist, _noincome, d_noincome FROM public._finance_overview_all(_team_id, m, e) o LEFT JOIN public.boards b ON b.id = o.board_id;
  RETURN jsonb_build_array(
    jsonb_build_object('code','running_timers','severity','block','count',_running,'amount',null,'details',d_running),
    jsonb_build_object('code','unclassified_expenses','severity','block','count',_uncls,'amount',null,'details',d_uncls),
    jsonb_build_object('code','revenue_without_value','severity','warn','count',_norev,'amount',null,'details',d_norev),
    jsonb_build_object('code','hours_without_cost','severity','block','count',_nocost,'amount',round(_nocost_h, 2),'details',d_nocost),
    jsonb_build_object('code','incomplete_allocations','severity','block','count',_badscope,'amount',null,'details',d_badscope),
    jsonb_build_object('code','unallocated_amount','severity','block','count',_unalloc_n,'amount',round(_unalloc, 2),'details',d_unalloc),
    jsonb_build_object('code','totals_mismatch','severity','block','count',CASE WHEN abs(_exp_total - _unalloc + _surplus - _exp_dist) > 0.01 THEN 1 ELSE 0 END,'amount',round(_exp_total - _unalloc + _surplus - _exp_dist, 2),'details','[]'::jsonb),
    jsonb_build_object('code','boards_without_revenue','severity','warn','count',_noincome,'amount',null,'details',d_noincome)
  );
END $function$;

CREATE OR REPLACE FUNCTION public.finance_people_gaps(_team_id uuid, _competence date)
 RETURNS TABLE(user_id uuid, name text, hours numeric, missing_kind boolean, missing_cost boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := (select auth.uid()); _comp date := date_trunc('month', _competence)::date;
BEGIN
  IF NOT (public.has_finance_permission(_uid, 'finance.view_employee_costs', _team_id, NULL)
       OR public.has_finance_permission(_uid, 'finance.manage_settings', _team_id, NULL)
       OR public.can_manage_finance_access(_uid, _team_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY
  WITH s AS (SELECT sl.user_id u, sum(sl.hours) h FROM _finance_time_slices(_team_id, _comp) sl GROUP BY sl.user_id),
  f AS (
    SELECT s.u, s.h,
      NOT EXISTS (SELECT 1 FROM finance_member_profiles mp WHERE mp.team_id = _team_id AND mp.user_id = s.u
        AND mp.valid_from <= (_comp + interval '1 month - 1 day')::date AND (mp.valid_to IS NULL OR mp.valid_to >= _comp)) mk,
      NOT EXISTS (SELECT 1 FROM public._finance_member_cost(_team_id, s.u, _comp) x WHERE x.monthly_cost IS NOT NULL) mc
    FROM s WHERE s.h > 0
  )
  SELECT f.u, coalesce(p.full_name, 'Sem nome'), round(f.h, 2), f.mk, f.mc
  FROM f LEFT JOIN profiles p ON p.id = f.u WHERE f.mk OR f.mc ORDER BY f.h DESC;
END $function$;

CREATE OR REPLACE FUNCTION public._finance_project_month_live(_project_id uuid, _competence date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _comp date := date_trunc('month', _competence)::date;
  _end date := (date_trunc('month', _competence) + interval '1 month - 1 day')::date;
  _p record; _ct numeric; _cm numeric; _pt numeric; _pv numeric; _pm numeric;
  _boards uuid[]; _gross numeric; _tax numeric; _direct numeric; _fixa numeric; _oper numeric; _adm numeric;
  _hours numeric; _cost numeric; _miss_h numeric; _miss_p int; _status text; _tax_rate numeric; _target numeric; _var numeric;
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
    FROM finance_revenues WHERE team_id = _p.team_id AND board_id = ANY(_boards) AND date_trunc('month', competence)::date = _comp;
  SELECT coalesce(sum(amount), 0) INTO _direct FROM finance_expenses
    WHERE team_id = _p.team_id AND board_id = ANY(_boards) AND date_trunc('month', competence)::date = _comp;
  SELECT coalesce(sum(al.amount) FILTER (WHERE e.expense_type = 'fixa'), 0),
         coalesce(sum(al.amount) FILTER (WHERE e.expense_type = 'operacional'), 0),
         coalesce(sum(al.amount) FILTER (WHERE e.expense_type NOT IN ('fixa','operacional')), 0)
    INTO _fixa, _oper, _adm
    FROM _finance_allocations(_p.team_id, _comp, _comp) al JOIN finance_expenses e ON e.id = al.expense_id
    WHERE al.board_id = ANY(_boards);

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
    'team_cost', round(_cost, 2), 'hours', round(_hours, 2), 'hours_without_cost', round(_miss_h, 2), 'people_without_cost', _miss_p);
END $function$;

CREATE OR REPLACE FUNCTION public.get_project_hours_costs(_project_id uuid, _competence date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := (select auth.uid());
  _team uuid; _detail boolean; _comp date := date_trunc('month', _competence)::date;
  _people jsonb; _audit jsonb; _summary jsonb; _expenses jsonb; _pending numeric;
BEGIN
  SELECT team_id INTO _team FROM projects WHERE id = _project_id;
  IF _team IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT (public.can_read_finance_structure(_uid, _team)
          OR public.has_finance_permission(_uid, 'finance.view_project', _team, NULL)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  _detail := public.has_finance_permission(_uid, 'finance.view_employee_costs', _team, NULL);

  CREATE TEMP TABLE IF NOT EXISTS _phc (user_id uuid, demand_id uuid, hours numeric, raw_hours numeric, is_split boolean, is_running boolean, overlapped boolean, project_id uuid, status text) ON COMMIT DROP;
  TRUNCATE _phc;
  INSERT INTO _phc
  SELECT s.user_id, s.demand_id, s.hours, s.raw_hours, s.is_split, s.is_running, s.overlapped, a.project_id, coalesce(a.status, 'pending')
  FROM public._finance_time_slices(_team, _comp) s
  LEFT JOIN finance_demand_attributions a ON a.demand_id = s.demand_id AND a.competence = _comp;

  SELECT coalesce(sum(hours), 0) INTO _pending FROM _phc WHERE project_id IS NULL;

  WITH per AS (
    SELECT h.user_id, sum(h.hours) AS hours FROM _phc h WHERE h.project_id = _project_id GROUP BY h.user_id
  ), j AS (
    SELECT per.user_id, per.hours, p.full_name,
      (SELECT mp.kind FROM finance_member_profiles mp WHERE mp.team_id = _team AND mp.user_id = per.user_id
         AND mp.valid_from <= (_comp + interval '1 month - 1 day')::date AND (mp.valid_to IS NULL OR mp.valid_to >= _comp)
         ORDER BY mp.valid_from DESC LIMIT 1) AS kind,
      (SELECT CASE WHEN x.productive_hours > 0 THEN x.monthly_cost / x.productive_hours END
         FROM public._finance_member_cost(_team, per.user_id, _comp) x LIMIT 1) AS hourly
    FROM per LEFT JOIN profiles p ON p.id = per.user_id
  )
  SELECT
    jsonb_build_object(
      'internal_hours', coalesce(sum(hours) FILTER (WHERE kind = 'internal'), 0),
      'client_external_hours', coalesce(sum(hours) FILTER (WHERE kind = 'client_external'), 0),
      'contractor_hours', coalesce(sum(hours) FILTER (WHERE kind = 'contractor'), 0),
      'unclassified_hours', coalesce(sum(hours) FILTER (WHERE kind IS NULL), 0),
      'personnel_cost', round(coalesce(sum(hours * hourly), 0), 2),
      'missing_cost_people', count(*) FILTER (WHERE hourly IS NULL),
      'missing_cost_hours', coalesce(sum(hours) FILTER (WHERE hourly IS NULL), 0),
      'people_count', count(*),
      'pending_hours', _pending),
    CASE WHEN _detail THEN coalesce(jsonb_agg(jsonb_build_object(
      'user_id', user_id, 'name', coalesce(full_name, 'Sem nome'), 'kind', kind, 'hours', round(hours, 2),
      'hourly_cost', round(hourly, 2), 'cost', CASE WHEN hourly IS NULL THEN NULL ELSE round(hours * hourly, 2) END
    ) ORDER BY hours DESC), '[]'::jsonb) ELSE NULL END
  INTO _summary, _people FROM j;

  SELECT jsonb_build_object(
    'overlap_entries', count(*) FILTER (WHERE overlapped),
    'overlap_hours_removed', round(coalesce(sum(raw_hours - hours) FILTER (WHERE overlapped), 0), 2),
    'split_entries', count(*) FILTER (WHERE is_split),
    'running_entries', count(*) FILTER (WHERE is_running))
  INTO _audit FROM _phc WHERE project_id = _project_id;

  WITH pb AS (
    SELECT board_id FROM project_boards WHERE project_id = _project_id
      AND valid_from <= (_comp + interval '1 month - 1 day')::date AND (valid_to IS NULL OR valid_to >= _comp)
  ), direct AS (
    SELECT coalesce(sum(amount), 0) v FROM finance_expenses WHERE team_id = _team AND competence = _comp AND board_id IN (SELECT board_id FROM pb)
  ), shared AS (
    SELECT e.expense_type, sum(al.amount) v
    FROM public._finance_allocations(_team, _comp, _comp) al JOIN finance_expenses e ON e.id = al.expense_id
    WHERE al.board_id IN (SELECT board_id FROM pb) GROUP BY e.expense_type
  ), unalloc AS (
    SELECT coalesce(sum(e.amount - coalesce((SELECT sum(al.amount) FROM public._finance_allocations(_team, _comp, _comp) al WHERE al.expense_id = e.id), 0)), 0) v
    FROM finance_expenses e WHERE e.team_id = _team AND e.competence = _comp AND e.board_id IS NULL
  )
  SELECT jsonb_build_object(
    'direct', (SELECT v FROM direct),
    'fixa', coalesce((SELECT v FROM shared WHERE expense_type = 'fixa'), 0),
    'operacional', coalesce((SELECT v FROM shared WHERE expense_type = 'operacional'), 0),
    'administrativa', coalesce((SELECT v FROM shared WHERE expense_type = 'administrativa'), 0),
    'team_unallocated', round((SELECT v FROM unalloc), 2))
  INTO _expenses;

  RETURN jsonb_build_object('competence', _comp, 'can_see_people', _detail, 'summary', _summary,
    'people', _people, 'audit', _audit, 'expenses', _expenses);
END $function$;

CREATE OR REPLACE FUNCTION public.finance_team_hourly_cost(_team_id uuid, _month date)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _uid uuid := (SELECT auth.uid()); _r jsonb;
BEGIN
  IF NOT (public.can_read_finance_structure(_uid, _team_id) OR public.has_finance_permission(_uid, 'finance.view_project', _team_id, NULL)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  SELECT jsonb_build_object('competence', date_trunc('month', _month)::date,
      'hourly_cost', round(sum(monthly_cost) / nullif(sum(productive_hours), 0), 2), 'people', count(*))
    INTO _r FROM public.finance_member_rates WHERE team_id = _team_id AND productive_hours > 0;
  RETURN coalesce(_r, jsonb_build_object('competence', NULL, 'hourly_cost', NULL, 'people', 0));
END $$;
REVOKE EXECUTE ON FUNCTION public.finance_team_hourly_cost(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_team_hourly_cost(uuid, date) TO authenticated;