CREATE OR REPLACE FUNCTION public.get_team_projects_hours(_team_id uuid, _from date, _to date)
RETURNS TABLE(project_id uuid, name text, status text, finance_enabled boolean, hours_registered numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _uid uuid := (select auth.uid());
BEGIN
  IF NOT (public.can_read_finance_structure(_uid, _team_id) OR public.has_finance_permission(_uid, 'finance.view_project', _team_id, NULL)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY
  SELECT p.id, p.name, p.status, p.finance_enabled,
    COALESCE((SELECT round(sum(e.duration_seconds)/3600.0, 2) FROM demand_time_entries e
      JOIN demands d ON d.id = e.demand_id
      WHERE e.started_at >= date_trunc('month', _from)
        AND e.started_at < date_trunc('month', _to) + interval '1 month'
        AND (EXISTS (SELECT 1 FROM project_demands pd WHERE pd.project_id = p.id AND pd.demand_id = d.id)
          OR EXISTS (SELECT 1 FROM project_boards pb WHERE pb.project_id = p.id AND pb.board_id = d.board_id))), 0)
  FROM projects p WHERE p.team_id = _team_id ORDER BY p.name;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_team_projects_hours(uuid, date, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_team_projects_hours(uuid, date, date) TO authenticated;