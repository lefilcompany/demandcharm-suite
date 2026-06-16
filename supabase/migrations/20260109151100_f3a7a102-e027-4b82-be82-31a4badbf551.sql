-- Fix the board creation policy (the current one has a bug comparing column to itself)
DROP POLICY IF EXISTS "Team admins/moderators can create boards" ON boards;

-- Create corrected policy allowing admin, moderator and executor to create boards
CREATE POLICY "Team members can create boards" ON boards
FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND
  EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = boards.team_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('admin', 'moderator', 'executor')
  )
);