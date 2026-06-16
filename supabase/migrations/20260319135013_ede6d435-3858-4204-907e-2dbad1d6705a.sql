
DROP POLICY IF EXISTS "Team owners can delete teams" ON public.teams;

CREATE POLICY "Team owners can delete teams"
ON public.teams FOR DELETE TO authenticated
USING (public.is_team_owner(auth.uid(), id));

DROP POLICY IF EXISTS "Team creators can add self as owner" ON public.team_members;

CREATE POLICY "Team creators can add self as owner"
ON public.team_members FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'owner'::public.team_membership_role
  AND public.is_team_creator(auth.uid(), team_id)
);

DROP POLICY IF EXISTS "Team owners can add members" ON public.team_members;

CREATE POLICY "Team owners can add members"
ON public.team_members FOR INSERT TO authenticated
WITH CHECK (
  public.is_team_owner(auth.uid(), team_id)
  AND role = 'member'::public.team_membership_role
);

DROP POLICY IF EXISTS "Team owners can remove members" ON public.team_members;

CREATE POLICY "Team owners can remove members"
ON public.team_members FOR DELETE TO authenticated
USING (public.is_team_owner(auth.uid(), team_id));

DROP POLICY IF EXISTS "Team owners can update members" ON public.team_members;

CREATE POLICY "Team owners can update members"
ON public.team_members FOR UPDATE TO authenticated
USING (public.is_team_owner(auth.uid(), team_id))
WITH CHECK (public.is_team_owner(auth.uid(), team_id));
