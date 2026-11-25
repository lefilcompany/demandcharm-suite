ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS performance_id uuid REFERENCES public.team_performances(id) ON DELETE SET NULL;

CREATE TABLE public.project_members (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  team_id uuid NOT NULL,
  added_by uuid,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX idx_project_members_team ON public.project_members(team_id);
GRANT SELECT ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members view project members" ON public.project_members FOR SELECT TO authenticated
  USING (public.is_team_member((select auth.uid()), team_id));

CREATE OR REPLACE FUNCTION public.set_project_staff(_project_id uuid, _performance_id uuid, _user_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_team uuid; v_creator uuid; v_pteam uuid; v_bad int;
BEGIN
  SELECT team_id, created_by INTO v_team, v_creator FROM projects WHERE id = _project_id;
  IF v_team IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT (v_creator = auth.uid() OR public.is_team_admin(auth.uid(), v_team)) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
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
REVOKE ALL ON FUNCTION public.set_project_staff(uuid, uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_project_staff(uuid, uuid, uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._finance_project_staffing(_team_id uuid, _comp date)
 RETURNS TABLE(project_id uuid, user_id uuid, share numeric, monthly_cost numeric, productive_hours numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH m AS (SELECT date_trunc('month', _comp)::date c, (date_trunc('month', _comp) + interval '1 month - 1 day')::date e,
                    ((date_trunc('month', _comp) + interval '1 month')::timestamp AT TIME ZONE 'America/Sao_Paulo') ets),
  proj AS (SELECT p.id, EXISTS (SELECT 1 FROM project_members x WHERE x.project_id = p.id) staffed
           FROM projects p, m WHERE p.team_id = _team_id AND p.finance_enabled AND public._project_active_in_month(p.id, m.c)),
  raw AS (
    SELECT pr.id project_id, pm.user_id FROM proj pr JOIN project_members pm ON pm.project_id = pr.id WHERE pr.staffed
    UNION
    SELECT pr.id, bm.user_id
    FROM proj pr CROSS JOIN m
    JOIN project_boards pb ON pb.project_id = pr.id AND pb.valid_from <= m.e AND (pb.valid_to IS NULL OR pb.valid_to >= m.c)
    JOIN board_members bm ON bm.board_id = pb.board_id AND bm.role <> 'requester' AND bm.joined_at < m.ets
    WHERE NOT pr.staffed
  ),
  mem AS (
    SELECT DISTINCT raw.project_id, raw.user_id FROM raw CROSS JOIN m
    JOIN team_members tm ON tm.team_id = _team_id AND tm.user_id = raw.user_id AND tm.member_kind = 'internal' AND tm.role <> 'requester'
    WHERE NOT EXISTS (SELECT 1 FROM finance_member_profiles mp WHERE mp.team_id = _team_id AND mp.user_id = raw.user_id
      AND mp.kind <> 'internal' AND mp.valid_from <= m.e AND (mp.valid_to IS NULL OR mp.valid_to >= m.c))
  ),
  n AS (SELECT mem.user_id, count(*) n FROM mem GROUP BY 1)
  SELECT mem.project_id, mem.user_id, 1.0 / n.n, mc.monthly_cost, mc.productive_hours
  FROM mem JOIN n ON n.user_id = mem.user_id
  CROSS JOIN m
  LEFT JOIN LATERAL public._finance_member_cost(_team_id, mem.user_id, m.c) mc ON true
$function$;
REVOKE ALL ON FUNCTION public._finance_project_staffing(uuid, date) FROM PUBLIC, anon, authenticated;