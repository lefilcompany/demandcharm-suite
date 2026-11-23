ALTER TABLE public.finance_revenues ALTER COLUMN board_id DROP NOT NULL;
ALTER TABLE public.finance_revenues ADD CONSTRAINT finance_revenues_target_chk CHECK (project_id IS NOT NULL OR board_id IS NOT NULL);
COMMENT ON TABLE public.finance_project_settings IS 'DEPRECATED: project math uses team-wide finance_team_defaults';
COMMENT ON COLUMN public.finance_revenues.tax_rate IS 'DEPRECATED: team tax rate from finance_team_defaults is always used';

CREATE OR REPLACE FUNCTION public._finance_team_rates(_team_id uuid, _comp date)
RETURNS TABLE(tax_rate numeric, variable_rate numeric, margin_target numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(d.tax_rate, s.tax_rate, 0.21), coalesce(d.variable_rate, 0), coalesce(d.margin_target, s.margin_target, 0.40)
  FROM (SELECT 1) one
  LEFT JOIN LATERAL (SELECT * FROM finance_team_defaults WHERE team_id = _team_id AND valid_from <= _comp ORDER BY valid_from DESC LIMIT 1) d ON true
  LEFT JOIN LATERAL (SELECT * FROM finance_settings WHERE team_id = _team_id AND board_id IS NULL LIMIT 1) s ON true
$$;
REVOKE EXECUTE ON FUNCTION public._finance_team_rates(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._finance_project_month_live(_project_id uuid, _competence date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public._project_billing_recipients(_project_id uuid)
RETURNS TABLE(user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT tm.user_id FROM projects p JOIN team_members tm ON tm.team_id = p.team_id
  WHERE p.id = _project_id AND p.team_id IS NOT NULL
    AND tm.user_id IS DISTINCT FROM p.created_by
    AND (tm.role::text = 'admin' OR public.profile_grants(tm.user_id, p.team_id, 'finance.manage_revenue', NULL)
         OR EXISTS (SELECT 1 FROM finance_permissions fp WHERE fp.user_id = tm.user_id AND fp.team_id = p.team_id
                    AND fp.permission = 'finance.manage_revenue' AND fp.board_id IS NULL AND fp.revoked_at IS NULL))
$$;
REVOKE EXECUTE ON FUNCTION public._project_billing_recipients(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_project_billing_recipients(_project_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT r.user_id FROM public._project_billing_recipients(_project_id) r
  WHERE EXISTS (SELECT 1 FROM projects p WHERE p.id = _project_id AND p.created_by = (select auth.uid()))
$$;
REVOKE EXECUTE ON FUNCTION public.get_project_billing_recipients(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_billing_recipients(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_project_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.team_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO notifications (user_id, title, message, type, link)
  SELECT r.user_id, 'Novo projeto criado: ' || NEW.name,
         'O projeto "' || NEW.name || '" foi criado. Configure o faturamento desse projeto.',
         'project_created', '/app/projects/' || NEW.id || '/finance?aba=revenue'
  FROM public._project_billing_recipients(NEW.id) r;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_project_created failed: %', SQLERRM;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_project_created() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_project_created ON public.projects;
CREATE TRIGGER trg_notify_project_created AFTER INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.notify_project_created();

CREATE OR REPLACE FUNCTION public.get_team_revenue_summary(_team_id uuid, _month date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  WITH rates AS (SELECT coalesce((SELECT tax_rate FROM finance_team_defaults WHERE team_id = _team_id AND valid_from <= date_trunc('month', _month)::date ORDER BY valid_from DESC LIMIT 1),
                                 (SELECT tax_rate FROM finance_settings WHERE team_id = _team_id AND board_id IS NULL LIMIT 1), 0.21) t),
  r AS (
    SELECT fr.project_id, sum(fr.gross_amount) gross FROM finance_revenues fr
    WHERE fr.team_id = _team_id AND date_trunc('month', fr.competence) = date_trunc('month', _month)
    GROUP BY fr.project_id
  ), rows AS (
    SELECT r.project_id, coalesce(p.name, 'Sem projeto') name, r.gross FROM r LEFT JOIN projects p ON p.id = r.project_id
  )
  SELECT jsonb_build_object(
    'tax_rate', (SELECT t FROM rates),
    'gross', round(coalesce((SELECT sum(gross) FROM rows), 0), 2),
    'tax', round(coalesce((SELECT sum(gross) FROM rows), 0) * (SELECT t FROM rates), 2),
    'projects', coalesce((SELECT jsonb_agg(jsonb_build_object('project_id', project_id, 'name', name, 'gross', round(gross, 2)) ORDER BY project_id IS NULL, gross DESC) FROM rows), '[]'::jsonb))
$$;
REVOKE EXECUTE ON FUNCTION public.get_team_revenue_summary(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_revenue_summary(uuid, date) TO authenticated;