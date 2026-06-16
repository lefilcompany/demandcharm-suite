-- Drop the policy and recreate with EXPLICIT public schema for function
DROP POLICY IF EXISTS "Team members can create boards" ON public.boards;

-- Recreate with fully qualified function name
CREATE POLICY "Team members can create boards" 
ON public.boards 
FOR INSERT 
TO public
WITH CHECK (
  (auth.uid() IS NOT NULL)
  AND (auth.uid() = created_by)
  AND (public.is_team_admin_or_moderator(auth.uid(), team_id) = true)
);