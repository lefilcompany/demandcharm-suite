ALTER TABLE public.finance_expenses ADD COLUMN IF NOT EXISTS allocation_pct numeric;
ALTER TABLE public.finance_expenses DROP CONSTRAINT IF EXISTS finance_expenses_method_chk;
ALTER TABLE public.finance_expenses ADD CONSTRAINT finance_expenses_method_chk CHECK (allocation_method IS NULL OR allocation_method IN ('hours','revenue','mixed','revenue_pct'));
ALTER TABLE public.finance_expenses ADD CONSTRAINT finance_expenses_pct_chk CHECK (
  (allocation_method = 'revenue_pct' AND allocation_pct > 0 AND allocation_pct <= 100)
  OR (allocation_method IS DISTINCT FROM 'revenue_pct' AND allocation_pct IS NULL));

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
    SELECT d.board_id, date_trunc('month', t.started_at)::date m, sum(COALESCE(t.duration_seconds,0))/3600.0 v
    FROM public.demand_time_entries t JOIN public.demands d ON d.id = t.demand_id JOIN public.boards b ON b.id = d.board_id
    WHERE b.team_id = _team_id AND t.started_at >= date_trunc('month', _from) AND t.started_at < date_trunc('month', _to) + interval '1 month'
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

CREATE TABLE public.finance_team_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  valid_from date NOT NULL,
  tax_rate numeric NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate < 1),
  margin_target numeric NOT NULL DEFAULT 0 CHECK (margin_target >= 0 AND margin_target < 1),
  variable_rate numeric NOT NULL DEFAULT 0 CHECK (variable_rate >= 0 AND variable_rate < 1),
  allocation_pct numeric NOT NULL DEFAULT 0 CHECK (allocation_pct >= 0 AND allocation_pct < 1),
  max_discount numeric NOT NULL DEFAULT 0 CHECK (max_discount >= 0 AND max_discount < 1),
  hourly_cost numeric NOT NULL DEFAULT 0 CHECK (hourly_cost >= 0),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, valid_from),
  CHECK (valid_from = date_trunc('month', valid_from)::date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_team_defaults TO authenticated;
GRANT ALL ON public.finance_team_defaults TO service_role;
ALTER TABLE public.finance_team_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY ftd_select ON public.finance_team_defaults FOR SELECT TO authenticated
  USING (public.can_read_finance_structure((SELECT auth.uid()), team_id) OR public.has_finance_permission((SELECT auth.uid()), 'finance.view_project', team_id, NULL::uuid));
CREATE POLICY ftd_insert ON public.finance_team_defaults FOR INSERT TO authenticated
  WITH CHECK (public.has_finance_permission((SELECT auth.uid()), 'finance.manage_settings', team_id, NULL::uuid) OR public.can_manage_finance_access((SELECT auth.uid()), team_id));
CREATE POLICY ftd_update ON public.finance_team_defaults FOR UPDATE TO authenticated
  USING (public.has_finance_permission((SELECT auth.uid()), 'finance.manage_settings', team_id, NULL::uuid) OR public.can_manage_finance_access((SELECT auth.uid()), team_id))
  WITH CHECK (public.has_finance_permission((SELECT auth.uid()), 'finance.manage_settings', team_id, NULL::uuid) OR public.can_manage_finance_access((SELECT auth.uid()), team_id));
CREATE POLICY ftd_delete ON public.finance_team_defaults FOR DELETE TO authenticated
  USING (public.has_finance_permission((SELECT auth.uid()), 'finance.manage_settings', team_id, NULL::uuid) OR public.can_manage_finance_access((SELECT auth.uid()), team_id));
CREATE TRIGGER finance_team_defaults_audit AFTER INSERT OR UPDATE OR DELETE ON public.finance_team_defaults
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();

CREATE OR REPLACE FUNCTION public.finance_seed_project_settings()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE d public.finance_team_defaults;
BEGIN
  IF EXISTS (SELECT 1 FROM public.finance_project_settings WHERE project_id = NEW.project_id) THEN RETURN NEW; END IF;
  SELECT * INTO d FROM public.finance_team_defaults WHERE team_id = NEW.team_id AND valid_from <= COALESCE(NEW.valid_from, current_date)
    ORDER BY valid_from DESC LIMIT 1;
  IF d.id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.finance_project_settings(project_id, team_id, valid_from, tax_rate, variable_rate, margin_target, created_by)
  VALUES (NEW.project_id, NEW.team_id, date_trunc('month', COALESCE(NEW.valid_from, current_date))::date, d.tax_rate, d.variable_rate, d.margin_target, auth.uid())
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.finance_seed_project_settings() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_project_board_seed_settings AFTER INSERT ON public.project_boards
  FOR EACH ROW EXECUTE FUNCTION public.finance_seed_project_settings();

CREATE OR REPLACE FUNCTION public._finance_close_checklist(_team_id uuid, _month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE m date := date_trunc('month', _month)::date; e date := (date_trunc('month', _month) + interval '1 month - 1 day')::date;
  _running int; _uncls int; _norev int; _nocost int; _nocost_h numeric; _badscope int; _unalloc_n int; _unalloc numeric;
  _exp_total numeric; _exp_dist numeric; _surplus numeric; _noincome int;
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
  WITH a AS (SELECT expense_id, sum(amount) s FROM public._finance_allocations(_team_id, m, e) GROUP BY 1)
  SELECT coalesce(sum(a.s - x.amount), 0) INTO _surplus
    FROM public.finance_expenses x JOIN a ON a.expense_id = x.id
    WHERE x.team_id = _team_id AND x.board_id IS NULL AND x.competence BETWEEN m AND e AND a.s - x.amount > 0.004;
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
    jsonb_build_object('code','totals_mismatch','severity','block','count',CASE WHEN abs(_exp_total - _unalloc + _surplus - _exp_dist) > 0.01 THEN 1 ELSE 0 END,'amount',round(_exp_total - _unalloc + _surplus - _exp_dist, 2)),
    jsonb_build_object('code','boards_without_revenue','severity','warn','count',_noincome,'amount',null)
  );
END $function$;

CREATE OR REPLACE FUNCTION public.get_finance_allocation(_team_id uuid, _from date, _to date)
 RETURNS TABLE(expense_id uuid, description text, expense_type text, allocation_method text, competence date, total numeric, board_id uuid, board_name text, amount numeric, share numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() uid),
  team_view AS (SELECT public.has_finance_permission(me.uid, 'finance.view_team', _team_id) ok FROM me),
  a AS (SELECT * FROM public._finance_allocations(_team_id, _from, _to)),
  visible AS (
    SELECT a.*, b.name FROM a JOIN public.boards b ON b.id = a.board_id, me
    WHERE public.can_view_finance_board(me.uid, _team_id, a.board_id)
  ),
  ex AS (
    SELECT e.* FROM public.finance_expenses e
    WHERE e.team_id = _team_id AND e.board_id IS NULL AND e.allocation_method IS NOT NULL
      AND e.competence BETWEEN date_trunc('month', _from)::date AND _to
  )
  SELECT ex.id, ex.description, ex.expense_type, ex.allocation_method, date_trunc('month', ex.competence)::date, ex.amount, v.board_id, v.name, v.amount, v.share
  FROM visible v JOIN ex ON ex.id = v.expense_id
  UNION ALL
  SELECT ex.id, ex.description, ex.expense_type, ex.allocation_method, date_trunc('month', ex.competence)::date, ex.amount, NULL, NULL,
    ex.amount - COALESCE((SELECT sum(a.amount) FROM a WHERE a.expense_id = ex.id), 0), NULL
  FROM ex, team_view WHERE team_view.ok
    AND abs(ex.amount - COALESCE((SELECT sum(a.amount) FROM a WHERE a.expense_id = ex.id), 0)) > 0.004
$function$;