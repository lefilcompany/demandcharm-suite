-- Allow team owners to update team members (role, position, etc.)
CREATE POLICY "Team owners can update members"
ON public.team_members
FOR UPDATE
TO authenticated
USING (is_team_owner(auth.uid(), team_id))
WITH CHECK (is_team_owner(auth.uid(), team_id));

-- Allow team owners to remove members
CREATE POLICY "Team owners can remove members"
ON public.team_members
FOR DELETE
TO authenticated
USING (is_team_owner(auth.uid(), team_id));