CREATE OR REPLACE FUNCTION public.get_my_module_access(_team_id uuid)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT COALESCE((SELECT to_jsonb(p.permissions) FROM public.member_access_profiles m
       JOIN public.access_profiles p ON p.id = m.profile_id WHERE m.user_id = auth.uid() AND m.team_id = _team_id), '[]'::jsonb) AS perms
  )
  SELECT jsonb_build_object(
    'full', public.has_role(auth.uid(),'admin') OR public.is_team_admin(auth.uid(), _team_id),
    'permissions', CASE
      WHEN NOT (perms ? 'projects.view') AND EXISTS (
        SELECT 1 FROM public.project_members pm JOIN public.projects pr ON pr.id = pm.project_id
        WHERE pm.user_id = auth.uid() AND pr.team_id = _team_id)
      THEN perms || '["projects.view"]'::jsonb ELSE perms END)
  FROM base
$function$;