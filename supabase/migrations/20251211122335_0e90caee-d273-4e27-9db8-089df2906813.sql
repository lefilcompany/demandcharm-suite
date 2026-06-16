-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Team admins/moderators can add assignees" ON public.demand_assignees;

-- Create new policy that allows:
-- 1. Team admins/moderators
-- 2. The creator of the demand
CREATE POLICY "Team members can add assignees to their demands" 
ON public.demand_assignees 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM demands d
    JOIN team_members tm ON tm.team_id = d.team_id
    WHERE d.id = demand_id
      AND tm.user_id = auth.uid()
      AND (
        tm.role IN ('admin', 'moderator')
        OR d.created_by = auth.uid()
      )
  )
);