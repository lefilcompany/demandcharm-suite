-- All finance month cuts use America/Sao_Paulo, same as _finance_time_slices.
CREATE OR REPLACE FUNCTION public._sp_month_start(_d date) RETURNS timestamptz
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $$ SELECT (date_trunc('month', _d)::date)::timestamp AT TIME ZONE 'America/Sao_Paulo' $$;
CREATE OR REPLACE FUNCTION public._sp_month(_ts timestamptz) RETURNS date
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $$ SELECT date_trunc('month', _ts AT TIME ZONE 'America/Sao_Paulo')::date $$;
REVOKE EXECUTE ON FUNCTION public._sp_month_start(date) FROM anon;
REVOKE EXECUTE ON FUNCTION public._sp_month(timestamptz) FROM anon;

CREATE OR REPLACE FUNCTION public._finance_allocations(_team_id uuid, _from date, _to date)
 RETURNS TABLE(expense_id uuid, competence date, board_id uuid, amount numeric, share numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH months AS (SELECT generate_series(date_trunc('month', _from)::date, date_trunc('month', _to)::date, interval '1 month')::date AS m),
  shared AS (
    SELECT e.id, date_trunc('month', e.competence)::date m, e.amount, e.allocation_board_ids, e.allocation_method meth, e.allocation_pct pct,
      CASE e.allocation_method WHEN 'hours' THEN 1 WHEN 'revenue' THEN 0 ELSE COALESCE(e.hours_weight, 0.5) END w
    FROM public.finance_expenses e
    WHERE e.team_id = _team_id AND e.board_id IS NULL AND e.allocation_method IS NOT NULL
      AND e.competence BETWEEN date_trunc('month', _from)::date AND _to
  ),
  h AS (
    SELECT d.board_id, public._sp_month(t.started_at) m, sum(COALESCE(t.duration_seconds,0))/3600.0 v
    FROM public.demand_time_entries t JOIN public.demands d ON d.id = t.demand_id JOIN public.boards b ON b.id = d.board_id
    WHERE b.team_id = _team_id AND t.started_at >= public._sp_month_start(_from) AND t.started_at < public._sp_month_start((date_trunc('month', _to) + interval '1 month')::date)
    GROUP BY 1,2
  ),
  r AS (
    SELECT fr.board_id, date_trunc('month', fr.competence)::date m, sum(fr.gross_amount) v
    FROM public.finance_revenues fr WHERE fr.team_id = _team_id
      AND fr.competence BETWEEN date_trunc('month', _from)::date AND _to GROUP BY 1,2
  ),
  base AS (
    SELECT b.id board_id, months.m, COALESCE(h.v,0) hrs, COALESCE(r.v,0) gross
    FROM public.boards b CROSS JOIN months
    LEFT JOIN h ON h.board_id = b.id AND h.m = months.m
    LEFT JOIN r ON r.board_id = b.id AND r.m = months.m
    WHERE b.team_id = _team_id
  ),
  elig AS (
    SELECT s.id, s.m, s.amount, s.w, s.meth, s.pct, b.board_id, b.hrs, b.gross,
      sum(b.hrs) OVER (PARTITION BY s.id) sh, sum(b.gross) OVER (PARTITION BY s.id) sg
    FROM shared s JOIN base b ON b.m = s.m AND (s.allocation_board_ids IS NULL OR b.board_id = ANY(s.allocation_board_ids))
  ),
  sh AS (
    SELECT *, (CASE WHEN sh > 0 THEN w*hrs/sh ELSE 0 END) + (CASE WHEN sg > 0 THEN (1-w)*gross/sg ELSE 0 END) sp FROM elig WHERE meth <> 'revenue_pct'
  ),
  rd AS (
    SELECT id, m, board_id, sp, round(amount*sp, 2) a,
      round(amount * sum(sp) OVER (PARTITION BY id), 2) - sum(round(amount*sp, 2)) OVER (PARTITION BY id) resid,
      row_number() OVER (PARTITION BY id ORDER BY sp DESC, board_id) rn
    FROM sh
  )
  SELECT id, m, board_id, a + CASE WHEN rn = 1 THEN resid ELSE 0 END, sp FROM rd WHERE sp > 0
  UNION ALL
  SELECT id, m, board_id, round(gross * pct / 100, 2), CASE WHEN amount > 0 THEN round(gross * pct / 100, 2) / amount ELSE 0 END
  FROM elig WHERE meth = 'revenue_pct' AND gross > 0
$function$;

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
    SELECT d.board_id, public._sp_month(t.started_at) m, t.user_id, sum(COALESCE(t.duration_seconds, 0)) / 3600.0 h
    FROM public.demand_time_entries t JOIN public.demands d ON d.id = t.demand_id
    WHERE d.board_id IN (SELECT id FROM bs) AND t.started_at >= public._sp_month_start(_from) AND t.started_at < public._sp_month_start((date_trunc('month', _to) + interval '1 month')::date)
    GROUP BY 1, 2, 3
  ),
  cost AS (
    SELECT h.board_id, h.m, sum(h.h) h_total,
      sum(CASE WHEN c.id IS NOT NULL AND c.productive_hours > 0 THEN h.h * c.monthly_cost / c.productive_hours ELSE 0 END) cost,
      sum(CASE WHEN c.id IS NULL OR NOT c.productive_hours > 0 THEN h.h ELSE 0 END) h_missing
    FROM hrs h LEFT JOIN public.finance_employee_costs c ON c.team_id = _team_id AND c.user_id = h.user_id AND c.competence = h.m
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
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
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
    SELECT h.*, c.monthly_cost, c.productive_hours,
      CASE WHEN c.productive_hours > 0 THEN h.h * c.monthly_cost / c.productive_hours END cost
    FROM hrs h LEFT JOIN public.finance_employee_costs c ON c.team_id = _team_id AND c.user_id = h.user_id AND c.competence = h.m
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
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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
      AND NOT EXISTS (SELECT 1 FROM public.finance_employee_costs c WHERE c.team_id = _team_id AND c.user_id = t.user_id AND c.competence = m AND c.productive_hours > 0)
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
    coalesce(jsonb_agg(jsonb_build_object('label', coalesce(nullif(btrim(x.description),''),'Despesa'), 'detail', 'Sem base para dividir', 'value', round(x.amount - coalesce(a.s, 0), 2)::text, 'kind','money')), '[]')
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