DROP POLICY IF EXISTS "Users can view accessible projects" ON public.projects;
CREATE POLICY "Users can view accessible projects" ON public.projects FOR SELECT TO authenticated
USING (public.has_module_permission((select auth.uid()), team_id, 'projects.view', id)
  AND (created_by = (select auth.uid()) OR public.is_team_admin((select auth.uid()), team_id)
       OR EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = projects.id AND ps.user_id = (select auth.uid()))));

DROP POLICY IF EXISTS "Team members can create projects" ON public.projects;
CREATE POLICY "Team members can create projects" ON public.projects FOR INSERT TO authenticated
WITH CHECK (created_by = (select auth.uid()) AND public.is_team_member((select auth.uid()), team_id)
  AND public.has_module_permission((select auth.uid()), team_id, 'projects.edit'));

DROP POLICY IF EXISTS "Owners can update projects" ON public.projects;
CREATE POLICY "Owners can update projects" ON public.projects FOR UPDATE TO authenticated
USING (created_by = (select auth.uid()) AND public.has_module_permission((select auth.uid()), team_id, 'projects.edit', id))
WITH CHECK (created_by = (select auth.uid()) AND public.has_module_permission((select auth.uid()), team_id, 'projects.edit', id));

DROP POLICY IF EXISTS "Edit-shared users can update projects" ON public.projects;
CREATE POLICY "Edit-shared users can update projects" ON public.projects FOR UPDATE TO authenticated
USING (public.has_module_permission((select auth.uid()), team_id, 'projects.edit', id)
  AND EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = projects.id AND ps.user_id = (select auth.uid()) AND ps.permission = 'edit'))
WITH CHECK (public.has_module_permission((select auth.uid()), team_id, 'projects.edit', id)
  AND EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = projects.id AND ps.user_id = (select auth.uid()) AND ps.permission = 'edit'));

DROP POLICY IF EXISTS "Owners can delete projects" ON public.projects;
CREATE POLICY "Owners can delete projects" ON public.projects FOR DELETE TO authenticated
USING (created_by = (select auth.uid()) AND public.has_module_permission((select auth.uid()), team_id, 'projects.edit', id));