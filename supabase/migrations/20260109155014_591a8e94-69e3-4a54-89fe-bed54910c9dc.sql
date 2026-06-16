-- Drop the existing INSERT policy for boards
DROP POLICY IF EXISTS "Team members can create boards" ON public.boards;

-- Create a new INSERT policy with TO public to ensure it's always evaluated
-- Security is maintained through the WITH CHECK conditions
CREATE POLICY "Team members can create boards" 
ON public.boards 
FOR INSERT 
TO public
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = created_by 
  AND public.is_team_admin_or_moderator(auth.uid(), team_id)
);