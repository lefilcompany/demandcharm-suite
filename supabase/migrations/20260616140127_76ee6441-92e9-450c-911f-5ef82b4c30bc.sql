
-- Defensive rename: only act when old names still exist and new names don't yet.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='demand_folders')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='projects') THEN
    EXECUTE 'ALTER TABLE public.demand_folders RENAME TO projects';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='demand_folder_items')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_demands') THEN
    EXECUTE 'ALTER TABLE public.demand_folder_items RENAME TO project_demands';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='demand_folder_shares')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_shares') THEN
    EXECUTE 'ALTER TABLE public.demand_folder_shares RENAME TO project_shares';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='project_demands' AND column_name='folder_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='project_demands' AND column_name='project_id') THEN
    EXECUTE 'ALTER TABLE public.project_demands RENAME COLUMN folder_id TO project_id';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='project_shares' AND column_name='folder_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='project_shares' AND column_name='project_id') THEN
    EXECUTE 'ALTER TABLE public.project_shares RENAME COLUMN folder_id TO project_id';
  END IF;
END $$;

-- Permission helper functions (project-named) + legacy wrappers
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND created_by = _user_id)
      OR EXISTS (SELECT 1 FROM public.project_shares WHERE project_id = _project_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.has_project_edit_access(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND created_by = _user_id)
      OR EXISTS (SELECT 1 FROM public.project_shares
                 WHERE project_id = _project_id AND user_id = _user_id AND permission = 'edit')
$$;

CREATE OR REPLACE FUNCTION public.is_project_owner(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND created_by = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.has_folder_access(_user_id uuid, _folder_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_project_access(_user_id, _folder_id)
$$;

CREATE OR REPLACE FUNCTION public.has_folder_edit_access(_user_id uuid, _folder_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_project_edit_access(_user_id, _folder_id)
$$;

CREATE OR REPLACE FUNCTION public.is_folder_owner(_user_id uuid, _folder_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_project_owner(_user_id, _folder_id)
$$;

-- Drop ALL existing policies on the three project tables to start clean
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='projects' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.projects', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_demands' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_demands', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_shares' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_shares', pol.policyname);
  END LOOP;
END $$;

-- Re-grant Data API access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_demands TO authenticated;
GRANT ALL ON public.project_demands TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_shares TO authenticated;
GRANT ALL ON public.project_shares TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;

-- projects
CREATE POLICY "Users can view accessible projects" ON public.projects
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = projects.id AND ps.user_id = auth.uid())
  );

CREATE POLICY "Team members can create projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_team_member(auth.uid(), team_id));

CREATE POLICY "Owners can update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Edit-shared users can update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_shares ps
                 WHERE ps.project_id = projects.id AND ps.user_id = auth.uid() AND ps.permission = 'edit'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.project_shares ps
                 WHERE ps.project_id = projects.id AND ps.user_id = auth.uid() AND ps.permission = 'edit'));

CREATE POLICY "Owners can delete projects" ON public.projects
  FOR DELETE TO authenticated USING (created_by = auth.uid());

-- project_demands
CREATE POLICY "Users can view project demands they can access" ON public.project_demands
  FOR SELECT TO authenticated USING (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Users with edit access can add demands to project" ON public.project_demands
  FOR INSERT TO authenticated WITH CHECK (public.has_project_edit_access(auth.uid(), project_id));

CREATE POLICY "Users with edit access can remove demands from project" ON public.project_demands
  FOR DELETE TO authenticated USING (public.has_project_edit_access(auth.uid(), project_id));

-- project_shares
CREATE POLICY "Users can view shares of accessible projects" ON public.project_shares
  FOR SELECT TO authenticated USING (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Owners can create shares" ON public.project_shares
  FOR INSERT TO authenticated WITH CHECK (public.is_project_owner(auth.uid(), project_id));

CREATE POLICY "Owners can update shares" ON public.project_shares
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(auth.uid(), project_id))
  WITH CHECK (public.is_project_owner(auth.uid(), project_id));

CREATE POLICY "Owners can delete shares" ON public.project_shares
  FOR DELETE TO authenticated USING (public.is_project_owner(auth.uid(), project_id));

CREATE POLICY "Users can remove themselves from shares" ON public.project_shares
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Edit-shared users can create shares" ON public.project_shares
  FOR INSERT TO authenticated WITH CHECK (public.has_project_edit_access(auth.uid(), project_id));

CREATE POLICY "Edit-shared users can update shares" ON public.project_shares
  FOR UPDATE TO authenticated
  USING (public.has_project_edit_access(auth.uid(), project_id))
  WITH CHECK (public.has_project_edit_access(auth.uid(), project_id));

CREATE POLICY "Edit-shared users can delete shares" ON public.project_shares
  FOR DELETE TO authenticated USING (public.has_project_edit_access(auth.uid(), project_id));
