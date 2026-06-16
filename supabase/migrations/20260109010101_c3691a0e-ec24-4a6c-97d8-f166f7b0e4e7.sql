-- Drop the existing INSERT policy on boards
DROP POLICY IF EXISTS "Team admins/moderators/executors can create boards" ON public.boards;

-- Create a corrected INSERT policy for boards
-- The policy should allow team admins and moderators to create boards
CREATE POLICY "Team admins/moderators can create boards"
ON public.boards
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND is_team_admin_or_moderator(team_id, auth.uid())
);