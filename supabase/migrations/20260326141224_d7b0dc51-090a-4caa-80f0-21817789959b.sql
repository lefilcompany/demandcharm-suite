CREATE OR REPLACE FUNCTION public.get_join_request_profiles(request_team_id uuid)
RETURNS TABLE(id uuid, full_name text, avatar_url text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.email
  FROM profiles p
  INNER JOIN team_join_requests tjr ON tjr.user_id = p.id
  WHERE tjr.team_id = request_team_id
    AND tjr.status = 'pending'
    AND is_team_owner(auth.uid(), request_team_id)
$$;