-- 1) Índices que aceleram as checagens de permissão
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members USING btree (team_id);

-- 2) Políticas: resolver auth.uid() uma vez por consulta (InitPlan) em vez de por linha

-- profiles
DROP POLICY IF EXISTS "Team members can view teammate profiles" ON public.profiles;
CREATE POLICY "Team members can view teammate profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  ((select auth.uid()) = id)
  OR (id IN (SELECT tm.user_id FROM public.team_members tm
             WHERE tm.team_id IN (SELECT public.get_user_team_ids((select auth.uid())))))
  OR (id IN (SELECT bm.user_id FROM public.board_members bm
             WHERE bm.board_id IN (SELECT public.get_user_board_ids((select auth.uid())))))
);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO public
USING ((select auth.uid()) = id);

-- demands
DROP POLICY IF EXISTS "Board members can view demands" ON public.demands;
CREATE POLICY "Board members can view demands"
ON public.demands FOR SELECT TO public
USING (board_id IN (SELECT public.get_user_board_ids((select auth.uid()))));

DROP POLICY IF EXISTS "Board members can update demands" ON public.demands;
CREATE POLICY "Board members can update demands"
ON public.demands FOR UPDATE TO public
USING (board_id IN (SELECT public.get_user_board_ids((select auth.uid()))));

DROP POLICY IF EXISTS "Board members can create demands" ON public.demands;
CREATE POLICY "Board members can create demands"
ON public.demands FOR INSERT TO public
WITH CHECK (board_id IN (SELECT public.get_user_board_ids((select auth.uid()))));

DROP POLICY IF EXISTS "Board members can delete trashed demands" ON public.demands;
CREATE POLICY "Board members can delete trashed demands"
ON public.demands FOR DELETE TO authenticated
USING (archived = true AND board_id IN (SELECT public.get_user_board_ids((select auth.uid()))));

-- board_members
DROP POLICY IF EXISTS "Board members can view other members" ON public.board_members;
CREATE POLICY "Board members can view other members"
ON public.board_members FOR SELECT TO public
USING (board_id IN (SELECT public.get_user_board_ids((select auth.uid()))));

DROP POLICY IF EXISTS "Team admins/moderators can view board members" ON public.board_members;
CREATE POLICY "Team admins/moderators can view board members"
ON public.board_members FOR SELECT TO public
USING (public.is_team_admin_or_moderator_for_board((select auth.uid()), board_id));

DROP POLICY IF EXISTS "Board admins/moderators can add members" ON public.board_members;
CREATE POLICY "Board admins/moderators can add members"
ON public.board_members FOR INSERT TO public
WITH CHECK (public.is_board_admin_or_moderator((select auth.uid()), board_id));

DROP POLICY IF EXISTS "Board admins/moderators can remove members" ON public.board_members;
CREATE POLICY "Board admins/moderators can remove members"
ON public.board_members FOR DELETE TO public
USING (public.is_board_admin_or_moderator((select auth.uid()), board_id));

DROP POLICY IF EXISTS "Board admins/moderators can update member roles" ON public.board_members;
CREATE POLICY "Board admins/moderators can update member roles"
ON public.board_members FOR UPDATE TO public
USING (public.is_board_admin_or_moderator((select auth.uid()), board_id));

DROP POLICY IF EXISTS "Team admins/moderators can add board members" ON public.board_members;
CREATE POLICY "Team admins/moderators can add board members"
ON public.board_members FOR INSERT TO public
WITH CHECK (public.is_team_admin_or_moderator_for_board((select auth.uid()), board_id));

DROP POLICY IF EXISTS "Team admins/moderators can remove board members" ON public.board_members;
CREATE POLICY "Team admins/moderators can remove board members"
ON public.board_members FOR DELETE TO public
USING (public.is_team_admin_or_moderator_for_board((select auth.uid()), board_id));

DROP POLICY IF EXISTS "Team admins/moderators can update board members" ON public.board_members;
CREATE POLICY "Team admins/moderators can update board members"
ON public.board_members FOR UPDATE TO public
USING (public.is_team_admin_or_moderator_for_board((select auth.uid()), board_id))
WITH CHECK (public.is_team_admin_or_moderator_for_board((select auth.uid()), board_id));

-- team_members
DROP POLICY IF EXISTS "Users can view team members of their teams" ON public.team_members;
CREATE POLICY "Users can view team members of their teams"
ON public.team_members FOR SELECT TO public
USING (team_id IN (SELECT public.get_user_team_ids((select auth.uid()))));

DROP POLICY IF EXISTS "Admins can view all team members" ON public.team_members;
CREATE POLICY "Admins can view all team members"
ON public.team_members FOR SELECT TO authenticated
USING (public.has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can leave teams" ON public.team_members;
CREATE POLICY "Users can leave teams"
ON public.team_members FOR DELETE TO public
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Team creators can add self as owner" ON public.team_members;
CREATE POLICY "Team creators can add self as owner"
ON public.team_members FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id AND role = 'admin'::team_role AND public.is_team_creator((select auth.uid()), team_id));

DROP POLICY IF EXISTS "Team owners can add members" ON public.team_members;
CREATE POLICY "Team owners can add members"
ON public.team_members FOR INSERT TO authenticated
WITH CHECK ((public.is_team_owner((select auth.uid()), team_id) OR public.is_team_admin((select auth.uid()), team_id)) AND role = 'requester'::team_role);

DROP POLICY IF EXISTS "Team owners can remove members" ON public.team_members;
CREATE POLICY "Team owners can remove members"
ON public.team_members FOR DELETE TO authenticated
USING (public.is_team_owner((select auth.uid()), team_id) OR public.is_team_admin((select auth.uid()), team_id));

DROP POLICY IF EXISTS "Team owners can update members" ON public.team_members;
CREATE POLICY "Team owners can update members"
ON public.team_members FOR UPDATE TO authenticated
USING (public.is_team_owner((select auth.uid()), team_id) OR public.is_team_admin((select auth.uid()), team_id))
WITH CHECK (public.is_team_owner((select auth.uid()), team_id) OR public.is_team_admin((select auth.uid()), team_id));

-- 3) Fechar funções internas para visitantes anônimos
REVOKE EXECUTE ON FUNCTION public.trg_bump_demands_version() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_seed_service_catalog_on_team() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_access_on_team_member_removed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_old_read_notifications() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_board_demands_version(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.convert_subdemand_to_request(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_index_status(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.board_demand_facts(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_board_metrics(uuid, date, date, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_board_documents(uuid, extensions.vector, integer, double precision) FROM PUBLIC, anon;
