-- Drop the existing INSERT policy for boards
DROP POLICY IF EXISTS "Team members can create boards" ON public.boards;

-- Create a new INSERT policy that only allows admin and moderator (not executor)
CREATE POLICY "Team members can create boards" 
ON public.boards 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = created_by 
  AND (
    public.has_team_role(auth.uid(), team_id, 'admin'::team_role)
    OR public.has_team_role(auth.uid(), team_id, 'moderator'::team_role)
  )
);