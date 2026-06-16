-- 1) Restrict shared-demand interaction reads to the 'general' channel so the
--    staff-only 'internal' channel is not exposed via public share links.
DROP POLICY IF EXISTS "Anonymous can view interactions for shared demands" ON public.demand_interactions;
DROP POLICY IF EXISTS "Authenticated can view interactions for shared demands" ON public.demand_interactions;

CREATE POLICY "Anonymous can view general interactions for shared demands"
ON public.demand_interactions
FOR SELECT
TO anon
USING (is_demand_shared(demand_id) AND channel = 'general');

CREATE POLICY "Authenticated can view general interactions for shared demands"
ON public.demand_interactions
FOR SELECT
TO authenticated
USING (is_demand_shared(demand_id) AND channel = 'general');

-- 2) Remove the direct INSERT path on team_members that let any authenticated
--    user join any team as 'requester' without the access code. The
--    join_team_with_code() SECURITY DEFINER RPC remains the only join path.
DROP POLICY IF EXISTS "Users can join teams with access code" ON public.team_members;