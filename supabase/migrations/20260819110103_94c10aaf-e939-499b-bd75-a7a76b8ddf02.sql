-- WORK SCHEDULES
DROP POLICY IF EXISTS "Team admins manage work schedules" ON public.user_work_schedules;
DROP POLICY IF EXISTS "Users manage own work schedule" ON public.user_work_schedules;
DROP POLICY IF EXISTS "Team members can view work schedules" ON public.user_work_schedules;

CREATE POLICY "work_schedules_select_team_members"
ON public.user_work_schedules FOR SELECT TO authenticated
USING (public.is_team_member(auth.uid(), team_id));

CREATE POLICY "work_schedules_insert_own"
ON public.user_work_schedules FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_team_member(auth.uid(), team_id));

CREATE POLICY "work_schedules_update_own"
ON public.user_work_schedules FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND public.is_team_member(auth.uid(), team_id));

CREATE POLICY "work_schedules_delete_own"
ON public.user_work_schedules FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- ABSENCES
DROP POLICY IF EXISTS "Team admins manage absences" ON public.user_absences;
DROP POLICY IF EXISTS "Users manage own absences" ON public.user_absences;
DROP POLICY IF EXISTS "Team members can view absences" ON public.user_absences;

CREATE POLICY "absences_select_team_members"
ON public.user_absences FOR SELECT TO authenticated
USING (public.is_team_member(auth.uid(), team_id));

CREATE POLICY "absences_insert_own"
ON public.user_absences FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_team_member(auth.uid(), team_id));

CREATE POLICY "absences_update_own"
ON public.user_absences FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND public.is_team_member(auth.uid(), team_id));

CREATE POLICY "absences_delete_own"
ON public.user_absences FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- HOLIDAYS
DROP POLICY IF EXISTS "Team admins manage holidays" ON public.team_holidays;
DROP POLICY IF EXISTS "Team members can view holidays" ON public.team_holidays;

CREATE POLICY "holidays_select_team_members"
ON public.team_holidays FOR SELECT TO authenticated
USING (public.is_team_member(auth.uid(), team_id));

CREATE POLICY "holidays_insert_admins"
ON public.team_holidays FOR INSERT TO authenticated
WITH CHECK (public.is_team_admin_or_moderator(auth.uid(), team_id));

CREATE POLICY "holidays_update_admins"
ON public.team_holidays FOR UPDATE TO authenticated
USING (public.is_team_admin_or_moderator(auth.uid(), team_id))
WITH CHECK (public.is_team_admin_or_moderator(auth.uid(), team_id));

CREATE POLICY "holidays_delete_admins"
ON public.team_holidays FOR DELETE TO authenticated
USING (public.is_team_admin_or_moderator(auth.uid(), team_id));