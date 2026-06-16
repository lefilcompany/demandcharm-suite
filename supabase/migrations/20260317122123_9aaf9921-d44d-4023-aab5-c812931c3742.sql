
-- Fix: Allow authenticated users (not just anon) to access shared demand data
-- This fixes the issue where logged-in users who aren't board members see "expired" on shared links

-- 1. demand_share_tokens: allow authenticated to verify tokens
CREATE POLICY "Authenticated can verify share tokens"
ON public.demand_share_tokens FOR SELECT
TO authenticated
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- 2. demands: allow authenticated to view shared demands
CREATE POLICY "Authenticated can view shared demands"
ON public.demands FOR SELECT
TO authenticated
USING (is_demand_shared(id));

-- 3. demand_interactions: allow authenticated to view interactions for shared demands
CREATE POLICY "Authenticated can view interactions for shared demands"
ON public.demand_interactions FOR SELECT
TO authenticated
USING (is_demand_shared(demand_id));

-- 4. demand_attachments: allow authenticated to view attachments for shared demands
CREATE POLICY "Authenticated can view attachments for shared demands"
ON public.demand_attachments FOR SELECT
TO authenticated
USING (is_demand_shared(demand_id));

-- 5. demand_assignees: allow authenticated to view assignees for shared demands
CREATE POLICY "Authenticated can view assignees for shared demands"
ON public.demand_assignees FOR SELECT
TO authenticated
USING (is_demand_shared(demand_id));

-- 6. profiles: allow authenticated to view profiles for shared demands
CREATE POLICY "Authenticated can view profiles for shared content"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT d.created_by FROM demands d WHERE is_demand_shared(d.id)
    UNION
    SELECT da.user_id FROM demand_assignees da JOIN demands d ON d.id = da.demand_id WHERE is_demand_shared(d.id)
    UNION
    SELECT di.user_id FROM demand_interactions di JOIN demands d ON d.id = di.demand_id WHERE is_demand_shared(d.id)
    UNION
    SELECT n.created_by FROM notes n WHERE is_note_shared(n.id)
  )
);

-- 7. teams: allow authenticated to view team info for shared demands
CREATE POLICY "Authenticated can view team info for shared content"
ON public.teams FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT d.team_id FROM demands d WHERE is_demand_shared(d.id)
    UNION
    SELECT n.team_id FROM notes n WHERE is_note_shared(n.id)
  )
);

-- 8. services: allow authenticated to view services for shared demands
CREATE POLICY "Authenticated can view services for shared demands"
ON public.services FOR SELECT
TO authenticated
USING (id IN (SELECT d.service_id FROM demands d WHERE is_demand_shared(d.id)));
