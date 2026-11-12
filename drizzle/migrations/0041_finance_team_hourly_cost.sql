CREATE OR REPLACE FUNCTION public.finance_team_hourly_cost(_team_id uuid, _month date)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _uid uuid := (SELECT auth.uid()); _m date; _r jsonb;
BEGIN
  IF NOT (public.can_read_finance_structure(_uid, _team_id) OR public.has_finance_permission(_uid, 'finance.view_project', _team_id, NULL)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  SELECT max(competence) INTO _m FROM public.finance_employee_costs
    WHERE team_id = _team_id AND competence <= date_trunc('month', _month)::date AND productive_hours > 0;
  IF _m IS NULL THEN RETURN jsonb_build_object('competence', NULL, 'hourly_cost', NULL, 'people', 0); END IF;
  -- Média ponderada pelas horas produtivas: soma dos custos / soma das horas. Nunca expõe o valor de cada pessoa.
  SELECT jsonb_build_object('competence', _m, 'hourly_cost', round(sum(monthly_cost) / nullif(sum(productive_hours), 0), 2), 'people', count(*))
    INTO _r FROM public.finance_employee_costs WHERE team_id = _team_id AND competence = _m AND productive_hours > 0;
  RETURN _r;
END $$;
REVOKE EXECUTE ON FUNCTION public.finance_team_hourly_cost(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_team_hourly_cost(uuid, date) TO authenticated;
COMMENT ON COLUMN public.finance_team_defaults.hourly_cost IS 'DEPRECATED: hourly cost now comes from finance_team_hourly_cost (per-person costs)';