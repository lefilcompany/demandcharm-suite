-- Drop the existing RESTRICTIVE policy
DROP POLICY IF EXISTS "Team members can create boards" ON public.boards;

-- Create a PERMISSIVE policy for board creation (only one needs to match)
CREATE POLICY "Team members can create boards" 
ON public.boards 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = created_by 
  AND public.is_team_admin_or_moderator(auth.uid(), team_id)
);