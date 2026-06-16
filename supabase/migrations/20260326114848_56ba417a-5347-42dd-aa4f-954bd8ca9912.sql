
-- Drop the broad SELECT policy that bypasses channel filtering
DROP POLICY IF EXISTS "Team members can view interactions" ON public.demand_interactions;

-- Drop the old channel-aware policy to recreate it as the single SELECT policy
DROP POLICY IF EXISTS "Channel-aware interaction visibility" ON public.demand_interactions;

-- Create unified SELECT policy: team members can view, but internal channel requires non-requester board role
CREATE POLICY "Team members can view interactions with channel check"
ON public.demand_interactions
FOR SELECT
TO authenticated
USING (
  can_view_demand_channel(auth.uid(), demand_id, channel)
  AND auth.uid() IN (
    SELECT tm.user_id
    FROM team_members tm
    JOIN demands d ON d.team_id = tm.team_id
    WHERE d.id = demand_interactions.demand_id
  )
);

-- Drop existing INSERT policy and recreate with channel restriction
DROP POLICY IF EXISTS "Team members can create interactions" ON public.demand_interactions;

-- Requesters can only insert into 'general' channel
CREATE POLICY "Team members can create interactions with channel check"
ON public.demand_interactions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND auth.uid() IN (
    SELECT tm.user_id
    FROM team_members tm
    JOIN demands d ON d.team_id = tm.team_id
    WHERE d.id = demand_interactions.demand_id
  )
  AND can_view_demand_channel(auth.uid(), demand_id, channel)
);
