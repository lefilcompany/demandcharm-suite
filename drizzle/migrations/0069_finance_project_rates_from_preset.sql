CREATE OR REPLACE FUNCTION public._finance_project_rates(_project_id uuid, _team_id uuid, _comp date)
RETURNS TABLE(tax_rate numeric, variable_rate numeric, margin_target numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(ps.tax_rate, tr.tax_rate), coalesce(ps.variable_rate, tr.variable_rate), coalesce(ps.margin_target, tr.margin_target)
  FROM public._finance_team_rates(_team_id, _comp) tr
  LEFT JOIN LATERAL (
    SELECT s.tax_rate, s.variable_rate, s.margin_target FROM public.finance_project_settings s
    JOIN public.projects p ON p.id = s.project_id AND p.finance_preset_id IS NOT NULL
    WHERE s.project_id = _project_id
    ORDER BY (s.valid_from <= _comp) DESC, CASE WHEN s.valid_from <= _comp THEN s.valid_from END DESC NULLS LAST, s.valid_from ASC
    LIMIT 1
  ) ps ON true
$$;
REVOKE EXECUTE ON FUNCTION public._finance_project_rates(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public._finance_project_month_live(uuid, date)'::regprocedure);
  IF position('_finance_team_rates(_p.team_id, _comp)' in d) > 0 THEN
    EXECUTE replace(d, 'public._finance_team_rates(_p.team_id, _comp)', 'public._finance_project_rates(_p.id, _p.team_id, _comp)');
  END IF;
  SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE proname = '_finance_overview_all' AND pronamespace = 'public'::regnamespace;
  IF position('_finance_team_rates(_team_id, pbm.m)' in d) > 0 THEN
    EXECUTE replace(d, 'public._finance_team_rates(_team_id, pbm.m)', 'public._finance_project_rates(pbm.project_id, _team_id, pbm.m)');
  END IF;
END $do$;