-- Drop and recreate the INSERT policy with explicit check
DROP POLICY IF EXISTS "Team admins/moderators can create boards" ON public.boards;

-- Create a more explicit INSERT policy
CREATE POLICY "Team admins/moderators can create boards" 
ON public.boards 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_members.user_id = auth.uid()
    AND team_members.team_id = boards.team_id
    AND team_members.role IN ('admin', 'moderator')
  )
);