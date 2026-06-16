-- Update SELECT policy to also allow team creators to see their teams
DROP POLICY IF EXISTS "Users can view teams they are members of" ON public.teams;

CREATE POLICY "Users can view their teams"
ON public.teams
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by 
  OR 
  auth.uid() IN (
    SELECT team_members.user_id
    FROM team_members
    WHERE team_members.team_id = teams.id
  )
);