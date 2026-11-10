CREATE OR REPLACE FUNCTION public.get_my_module_access(_team_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'full', public.has_role(auth.uid(),'admin') OR public.is_team_admin(auth.uid(), _team_id),
    'permissions', COALESCE((SELECT to_jsonb(p.permissions) FROM public.member_access_profiles m
       JOIN public.access_profiles p ON p.id = m.profile_id WHERE m.user_id = auth.uid() AND m.team_id = _team_id), '[]'::jsonb))
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_module_access(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_module_access(uuid) TO authenticated;