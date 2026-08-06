DROP POLICY IF EXISTS "Team owners can update members" ON public.team_members;
CREATE POLICY "Team owners can update members"
ON public.team_members
FOR UPDATE
TO authenticated
USING (public.is_team_owner(auth.uid(), team_id) OR public.is_team_admin(auth.uid(), team_id))
WITH CHECK (public.is_team_owner(auth.uid(), team_id) OR public.is_team_admin(auth.uid(), team_id));

DROP POLICY IF EXISTS "Team owners can remove members" ON public.team_members;
CREATE POLICY "Team owners can remove members"
ON public.team_members
FOR DELETE
TO authenticated
USING (public.is_team_owner(auth.uid(), team_id) OR public.is_team_admin(auth.uid(), team_id));

DROP POLICY IF EXISTS "Team owners can add members" ON public.team_members;
CREATE POLICY "Team owners can add members"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK ((public.is_team_owner(auth.uid(), team_id) OR public.is_team_admin(auth.uid(), team_id)) AND role = 'requester'::team_role);