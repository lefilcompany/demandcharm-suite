DROP POLICY IF EXISTS "Edit-shared users can create shares" ON public.project_shares;
DROP POLICY IF EXISTS "Edit-shared users can update shares" ON public.project_shares;
DROP POLICY IF EXISTS "Edit-shared users can delete shares" ON public.project_shares;
DROP POLICY IF EXISTS "Owners can create shares" ON public.project_shares;
CREATE POLICY "Owners can create shares" ON public.project_shares FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner((select auth.uid()), project_id) AND permission = 'view');
DROP POLICY IF EXISTS "Owners can update shares" ON public.project_shares;
CREATE POLICY "Owners can update shares" ON public.project_shares FOR UPDATE TO authenticated
  USING (public.is_project_owner((select auth.uid()), project_id))
  WITH CHECK (public.is_project_owner((select auth.uid()), project_id) AND permission = 'view');

CREATE OR REPLACE FUNCTION public.set_project_staff(_project_id uuid, _performance_id uuid, _user_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_team uuid; v_creator uuid; v_pteam uuid; v_bad int;
BEGIN
  SELECT team_id, created_by INTO v_team, v_creator FROM projects WHERE id = _project_id;
  IF v_team IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_creator IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT team_id INTO v_pteam FROM team_performances WHERE id = _performance_id;
  IF v_pteam IS DISTINCT FROM v_team THEN RAISE EXCEPTION 'PERFORMANCE_REQUIRED'; END IF;
  IF coalesce(array_length(_user_ids, 1), 0) = 0 THEN RAISE EXCEPTION 'PROJECT_MEMBERS_REQUIRED'; END IF;
  SELECT count(*) INTO v_bad FROM unnest(_user_ids) u(uid)
    WHERE NOT EXISTS (SELECT 1 FROM team_performance_members pm JOIN team_members tm ON tm.id = pm.team_member_id
      WHERE pm.performance_id = _performance_id AND tm.user_id = u.uid AND tm.team_id = v_team);
  IF v_bad > 0 THEN RAISE EXCEPTION 'MEMBER_NOT_IN_PERFORMANCE'; END IF;
  UPDATE projects SET performance_id = _performance_id WHERE id = _project_id;
  DELETE FROM project_members WHERE project_id = _project_id AND NOT (user_id = ANY(_user_ids));
  INSERT INTO project_members(project_id, user_id, team_id, added_by)
    SELECT _project_id, u, v_team, auth.uid() FROM unnest(_user_ids) u ON CONFLICT DO NOTHING;
END $$;