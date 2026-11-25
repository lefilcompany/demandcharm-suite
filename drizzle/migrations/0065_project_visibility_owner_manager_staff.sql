CREATE OR REPLACE FUNCTION public.can_view_project(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = _project_id AND (
      p.created_by = _user_id
      OR public.has_role(_user_id,'admin')
      OR public.is_team_admin(_user_id, p.team_id)
      OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = _user_id)
      OR EXISTS (
        SELECT 1 FROM public.member_access_profiles m JOIN public.access_profiles ap ON ap.id = m.profile_id
        WHERE m.user_id = _user_id AND m.team_id = p.team_id AND ap.system_key = 'project_manager'
          AND (m.all_projects OR EXISTS (SELECT 1 FROM public.member_access_project_scope s WHERE s.assignment_id = m.id AND s.project_id = p.id)))
    ));
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_project(uuid,uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.can_view_project(_user_id, _project_id)
$$;

DROP POLICY IF EXISTS "Users can view accessible projects" ON public.projects;
CREATE POLICY "Users can view accessible projects" ON public.projects FOR SELECT TO authenticated
  USING (public.can_view_project((select auth.uid()), id));

DROP POLICY IF EXISTS "Owners can create shares" ON public.project_shares;
DROP POLICY IF EXISTS "Owners can update shares" ON public.project_shares;
COMMENT ON TABLE public.project_shares IS 'DEPRECATED: external project sharing disabled; visibility = team owner, project managers, project staff';