DROP POLICY IF EXISTS "Team owners can view team requests" ON public.team_join_requests;
CREATE POLICY "Team owners can view team requests" ON public.team_join_requests FOR SELECT TO authenticated
USING (public.is_team_owner((select auth.uid()), team_id) OR public.is_team_admin((select auth.uid()), team_id));
DROP POLICY IF EXISTS "Team owners can update requests" ON public.team_join_requests;
CREATE POLICY "Team owners can update requests" ON public.team_join_requests FOR UPDATE TO authenticated
USING (public.is_team_owner((select auth.uid()), team_id) OR public.is_team_admin((select auth.uid()), team_id));
CREATE OR REPLACE FUNCTION public.get_join_request_profiles(request_team_id uuid)
 RETURNS TABLE(id uuid, full_name text, avatar_url text, email text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.email FROM profiles p
  INNER JOIN team_join_requests tjr ON tjr.user_id = p.id
  WHERE tjr.team_id = request_team_id AND tjr.status = 'pending'
    AND (is_team_owner(auth.uid(), request_team_id) OR is_team_admin(auth.uid(), request_team_id))
$$;