-- Custo de pessoal = horas contratadas (custo mensal) dos integrantes internos dos quadros do projeto,
-- dividido igualmente entre os projetos ativos de que a pessoa participa no mês (nunca conta duas vezes).
CREATE OR REPLACE FUNCTION public._finance_project_staffing(_team_id uuid, _comp date)
RETURNS TABLE(project_id uuid, user_id uuid, share numeric, monthly_cost numeric, productive_hours numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
  WITH m AS (SELECT date_trunc('month', _comp)::date c, (date_trunc('month', _comp) + interval '1 month - 1 day')::date e,
                    ((date_trunc('month', _comp) + interval '1 month')::timestamp AT TIME ZONE 'America/Sao_Paulo') ets),
  proj AS (SELECT p.id FROM projects p, m WHERE p.team_id = _team_id AND p.finance_enabled AND public._project_active_in_month(p.id, m.c)),
  mem AS (
    SELECT DISTINCT pr.id project_id, bm.user_id
    FROM proj pr CROSS JOIN m
    JOIN project_boards pb ON pb.project_id = pr.id AND pb.valid_from <= m.e AND (pb.valid_to IS NULL OR pb.valid_to >= m.c)
    JOIN board_members bm ON bm.board_id = pb.board_id AND bm.role <> 'requester' AND bm.joined_at < m.ets
    JOIN team_members tm ON tm.team_id = _team_id AND tm.user_id = bm.user_id AND tm.member_kind = 'internal' AND tm.role <> 'requester'
    WHERE NOT EXISTS (SELECT 1 FROM finance_member_profiles mp WHERE mp.team_id = _team_id AND mp.user_id = bm.user_id
      AND mp.kind <> 'internal' AND mp.valid_from <= m.e AND (mp.valid_to IS NULL OR mp.valid_to >= m.c))
  ),
  n AS (SELECT mem.user_id, count(*) n FROM mem GROUP BY 1)
  SELECT mem.project_id, mem.user_id, 1.0 / n.n, mc.monthly_cost, mc.productive_hours
  FROM mem JOIN n ON n.user_id = mem.user_id
  CROSS JOIN m
  LEFT JOIN LATERAL public._finance_member_cost(_team_id, mem.user_id, m.c) mc ON true
$fn$;
REVOKE ALL ON FUNCTION public._finance_project_staffing(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._finance_project_month_live(_project_id uuid, _competence date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _comp date := date_trunc('month', _competence)::date;
  _end date := (date_trunc('month', _competence) + interval '1 month - 1 day')::date;
  _p record;
  _boards uuid[]; _gross numeric; _tax numeric; _direct numeric; _fixa numeric; _oper numeric; _adm numeric;
  _hours numeric; _cost numeric; _miss_h numeric; _miss_p int; _status text; _tax_rate numeric; _target numeric; _var numeric;
  _share jsonb; _n int; _active boolean;
BEGIN
  SELECT id, team_id, name, finance_enabled, unit_external_id, integration_key INTO _p FROM projects WHERE id = _project_id;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT r.tax_rate, r.variable_rate, r.margin_target INTO _tax_rate, _var, _target FROM public._finance_team_rates(_p.team_id, _comp) r;

  SELECT coalesce(array_agg(DISTINCT board_id), '{}') INTO _boards FROM project_boards
    WHERE project_id = _project_id AND valid_from <= _end AND (valid_to IS NULL OR valid_to >= _comp);

  SELECT coalesce(sum(gross_amount), 0) INTO _gross
    FROM finance_revenues WHERE team_id = _p.team_id AND date_trunc('month', competence)::date = _comp
      AND (project_id = _project_id OR (project_id IS NULL AND board_id = ANY(_boards)));
  _tax := _gross * _tax_rate;
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

  SELECT coalesce(sum(st.productive_hours * st.share) FILTER (WHERE st.monthly_cost IS NOT NULL), 0),
         coalesce(sum(st.monthly_cost * st.share), 0), 0, count(*) FILTER (WHERE st.monthly_cost IS NULL)
    INTO _hours, _cost, _miss_h, _miss_p
    FROM public._finance_project_staffing(_p.team_id, _comp) st WHERE st.project_id = _project_id;

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

CREATE OR REPLACE FUNCTION public._finance_overview_all(_team_id uuid, _from date, _to date)
 RETURNS TABLE(board_id uuid, board_name text, competence date, gross numeric, tax numeric, direct_expenses numeric, allocated_expenses numeric, team_cost numeric, hours_realized numeric, hours_planned numeric, hours_without_cost numeric, margin_target numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH months AS (SELECT generate_series(date_trunc('month', _from)::date, date_trunc('month', _to)::date, interval '1 month')::date AS m),
  bs AS (SELECT b.id, b.name FROM public.boards b WHERE b.team_id = _team_id),
  team_cfg AS (SELECT tax_rate, margin_target FROM public.finance_settings WHERE team_id = _team_id AND board_id IS NULL),
  pbm AS (
    SELECT DISTINCT pb.project_id, pb.board_id, months.m FROM months
    JOIN public.project_boards pb ON pb.team_id = _team_id AND pb.valid_from <= (months.m + interval '1 month - 1 day')::date
      AND (pb.valid_to IS NULL OR pb.valid_to >= months.m)
  ),
  pbn AS (SELECT project_id, m, count(*) n FROM pbm GROUP BY 1, 2),
  rev0 AS (
    SELECT r.board_id, date_trunc('month', r.competence)::date m, r.gross_amount gross,
      r.gross_amount * COALESCE(r.tax_rate, bc.tax_rate, (SELECT tax_rate FROM team_cfg), 0.21) tax
    FROM public.finance_revenues r
    LEFT JOIN public.finance_settings bc ON bc.team_id = r.team_id AND bc.board_id = r.board_id
    WHERE r.team_id = _team_id AND r.project_id IS NULL AND r.board_id IN (SELECT id FROM bs)
      AND r.competence BETWEEN date_trunc('month', _from)::date AND _to
    UNION ALL
    SELECT pbm.board_id, pbm.m, r.gross_amount / pbn.n, r.gross_amount / pbn.n * tr.tax_rate
    FROM public.finance_revenues r
    JOIN pbm ON pbm.project_id = r.project_id AND pbm.m = date_trunc('month', r.competence)::date
    JOIN pbn ON pbn.project_id = r.project_id AND pbn.m = pbm.m
    CROSS JOIN LATERAL public._finance_team_rates(_team_id, pbm.m) tr
    WHERE r.team_id = _team_id AND r.project_id IS NOT NULL
      AND r.competence BETWEEN date_trunc('month', _from)::date AND _to
  ),
  rev AS (SELECT board_id, m, sum(gross) gross, sum(tax) tax FROM rev0 GROUP BY 1, 2),
  exp AS (
    SELECT e.board_id, date_trunc('month', e.competence)::date m, sum(e.amount) amt
    FROM public.finance_expenses e
    WHERE e.team_id = _team_id AND e.board_id IN (SELECT id FROM bs) AND e.competence BETWEEN date_trunc('month', _from)::date AND _to
    GROUP BY 1, 2
  ),
  share AS (
    SELECT months.m, public._finance_team_cost_share(_team_id, months.m) s FROM months
  ),
  tc AS (
    SELECT pbm.board_id, sh.m,
      sum(((sh.s->>'fixa')::numeric + (sh.s->>'operacional')::numeric + (sh.s->>'administrativa')::numeric)
          / (sh.s->>'active_projects')::int / pbn.n) amt
    FROM share sh
    CROSS JOIN LATERAL jsonb_array_elements(sh.s->'projects') pr
    JOIN pbm ON pbm.project_id = (pr->>'id')::uuid AND pbm.m = sh.m
    JOIN pbn ON pbn.project_id = pbm.project_id AND pbn.m = sh.m
    WHERE (sh.s->>'configured')::boolean AND (sh.s->>'active_projects')::int > 0
    GROUP BY 1, 2
  ),
  alloc0 AS (
    SELECT a.board_id, a.competence m, sum(a.amount) amt FROM public._finance_allocations(_team_id, _from, _to) a
    WHERE NOT EXISTS (SELECT 1 FROM share sh WHERE sh.m = a.competence AND (sh.s->>'configured')::boolean)
    GROUP BY 1, 2
    UNION ALL SELECT board_id, m, amt FROM tc
  ),
  alloc AS (SELECT board_id, m, sum(amt) amt FROM alloc0 GROUP BY 1, 2),
  hrs AS (
    SELECT d.board_id, public._sp_month(t.started_at) m, t.user_id, sum(COALESCE(t.duration_seconds, 0)) / 3600.0 h
    FROM public.demand_time_entries t JOIN public.demands d ON d.id = t.demand_id
    WHERE d.board_id IN (SELECT id FROM bs) AND t.started_at >= public._sp_month_start(_from) AND t.started_at < public._sp_month_start((date_trunc('month', _to) + interval '1 month')::date)
    GROUP BY 1, 2, 3
  ),
  staff AS (
    SELECT months.m, st.* FROM months CROSS JOIN LATERAL public._finance_project_staffing(_team_id, months.m) st
  ),
  scost AS (
    SELECT pbm.board_id, s.m, sum(coalesce(s.monthly_cost, 0) * s.share / pbn.n) cost
    FROM staff s JOIN pbm ON pbm.project_id = s.project_id AND pbm.m = s.m
    JOIN pbn ON pbn.project_id = s.project_id AND pbn.m = s.m
    GROUP BY 1, 2
  ),
  hsum AS (SELECT board_id, m, sum(h) h_total FROM hrs GROUP BY 1, 2),
  cost AS (
    SELECT coalesce(sc.board_id, hs.board_id) board_id, coalesce(sc.m, hs.m) m,
      coalesce(hs.h_total, 0) h_total, coalesce(sc.cost, 0) cost, 0::numeric h_missing
    FROM scost sc FULL JOIN hsum hs ON hs.board_id = sc.board_id AND hs.m = sc.m
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
    SELECT st.user_id, coalesce(st.productive_hours * st.share, 0) AS hours,
      CASE WHEN st.productive_hours > 0 THEN st.monthly_cost / st.productive_hours END AS hourly
    FROM public._finance_project_staffing(_team, _comp) st WHERE st.project_id = _project_id
  ), j AS (
    SELECT per.user_id, per.hours, p.full_name,
      (SELECT mp.kind FROM finance_member_profiles mp WHERE mp.team_id = _team AND mp.user_id = per.user_id
         AND mp.valid_from <= (_comp + interval '1 month - 1 day')::date AND (mp.valid_to IS NULL OR mp.valid_to >= _comp)
         ORDER BY mp.valid_from DESC LIMIT 1) AS kind,
      per.hourly
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
  ), sh AS (
    SELECT public._finance_team_cost_share(_team, _comp) s
  ), tcs AS (
    SELECT t.k expense_type, CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(sh.s->'projects') x WHERE (x->>'id')::uuid = _project_id)
      THEN (sh.s->>t.k)::numeric / nullif((sh.s->>'active_projects')::int, 0) ELSE 0 END v
    FROM sh, (VALUES ('fixa'),('operacional'),('administrativa')) t(k) WHERE (sh.s->>'configured')::boolean
  ), shared AS (
    SELECT e.expense_type, sum(al.amount) v
    FROM public._finance_allocations(_team, _comp, _comp) al JOIN finance_expenses e ON e.id = al.expense_id
    WHERE al.board_id IN (SELECT board_id FROM pb) AND NOT EXISTS (SELECT 1 FROM tcs) GROUP BY e.expense_type
    UNION ALL SELECT expense_type, v FROM tcs
  ), unalloc AS (
    SELECT coalesce(sum(e.amount - coalesce((SELECT sum(al.amount) FROM public._finance_allocations(_team, _comp, _comp) al WHERE al.expense_id = e.id), 0)), 0) v
    FROM finance_expenses e WHERE e.team_id = _team AND e.competence = _comp AND e.board_id IS NULL AND NOT EXISTS (SELECT 1 FROM tcs)
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