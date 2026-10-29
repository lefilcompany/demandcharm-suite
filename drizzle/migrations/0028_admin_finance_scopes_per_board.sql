CREATE OR REPLACE FUNCTION public.admin_finance_scopes()
RETURNS TABLE(kind text, scope_id uuid, name text, team_id uuid, team_name text, board_ids uuid[], finance_enabled boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role((select auth.uid()), 'admin'::app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT 'project'::text, p.id, p.name, p.team_id, t.name,
    COALESCE(array_agg(pb.board_id) FILTER (WHERE pb.board_id IS NOT NULL), '{}'::uuid[]), p.finance_enabled
  FROM projects p JOIN teams t ON t.id = p.team_id
  LEFT JOIN project_boards pb ON pb.project_id = p.id
    AND pb.valid_from <= current_date AND (pb.valid_to IS NULL OR pb.valid_to >= current_date)
  GROUP BY p.id, t.name
  UNION ALL
  SELECT 'unlinked'::text, b.id, b.name, t.id, t.name, ARRAY[b.id], false
  FROM boards b JOIN teams t ON t.id = b.team_id
  WHERE NOT EXISTS (SELECT 1 FROM project_boards pb WHERE pb.board_id = b.id
    AND pb.valid_from <= current_date AND (pb.valid_to IS NULL OR pb.valid_to >= current_date));
END $$;