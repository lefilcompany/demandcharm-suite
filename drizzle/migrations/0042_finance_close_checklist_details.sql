CREATE OR REPLACE FUNCTION public._finance_close_checklist(_team_id uuid, _month date)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE m date := date_trunc('month', _month)::date; e date := (date_trunc('month', _month) + interval '1 month - 1 day')::date;
  _running int; _uncls int; _norev int; _nocost int; _nocost_h numeric; _badscope int; _unalloc_n int; _unalloc numeric;
  _exp_total numeric; _exp_dist numeric; _surplus numeric; _noincome int;
  d_running jsonb; d_uncls jsonb; d_norev jsonb; d_nocost jsonb; d_badscope jsonb; d_unalloc jsonb; d_noincome jsonb;
BEGIN
  SELECT count(*), coalesce(jsonb_agg(jsonb_build_object('label', coalesce(p.full_name,'Colaborador'), 'detail', coalesce(d.title,'Demanda') || ' · ' || b.name, 'value', to_char(t.started_at AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI')) ORDER BY t.started_at), '[]')
    INTO _running, d_running
    FROM public.demand_time_entries t JOIN public.demands d ON d.id = t.demand_id JOIN public.boards b ON b.id = d.board_id
    LEFT JOIN public.profiles p ON p.id = t.user_id
    WHERE b.team_id = _team_id AND t.ended_at IS NULL AND t.started_at < e + 1;
  SELECT count(*), coalesce(jsonb_agg(jsonb_build_object('label', coalesce(nullif(btrim(x.description),''),'(sem descrição)'), 'detail', coalesce(nullif(btrim(x.category),''),'(sem categoria)'), 'value', x.amount::text, 'kind','money')), '[]')
    INTO _uncls, d_uncls FROM public.finance_expenses x WHERE x.team_id = _team_id AND x.competence BETWEEN m AND e
    AND (coalesce(btrim(x.category), '') = '' OR coalesce(btrim(x.description), '') = '');
  SELECT count(*), coalesce(jsonb_agg(jsonb_build_object('label', coalesce(b.name,'Sem quadro'), 'detail', to_char(r.competence,'MM/YYYY'), 'value', null)), '[]')
    INTO _norev, d_norev FROM public.finance_revenues r LEFT JOIN public.boards b ON b.id = r.board_id
    WHERE r.team_id = _team_id AND r.competence BETWEEN m AND e AND r.gross_amount = 0;
  WITH s AS (
    SELECT t.user_id, sum(t.duration_seconds) / 3600.0 h
    FROM public.demand_time_entries t JOIN public.demands d ON d.id = t.demand_id JOIN public.boards b ON b.id = d.board_id
    WHERE b.team_id = _team_id AND t.started_at >= m AND t.started_at < e + 1
      AND NOT EXISTS (SELECT 1 FROM public.finance_employee_costs c WHERE c.team_id = _team_id AND c.user_id = t.user_id AND c.competence = m AND c.productive_hours > 0)
    GROUP BY 1)
  SELECT count(*), coalesce(sum(s.h), 0),
    coalesce(jsonb_agg(jsonb_build_object('label', coalesce(p.full_name,'Colaborador'), 'detail', null, 'value', round(coalesce(s.h,0), 2)::text, 'kind','hours') ORDER BY s.h DESC), '[]')
    INTO _nocost, _nocost_h, d_nocost FROM s LEFT JOIN public.profiles p ON p.id = s.user_id;
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