CREATE OR REPLACE FUNCTION public.get_team_performance_staff(_team_id uuid)
RETURNS TABLE(performance_id uuid, user_id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tpm.performance_id, tm.user_id, COALESCE(NULLIF(p.full_name,''),'Sem nome')
  FROM public.team_performances tp
  JOIN public.team_performance_members tpm ON tpm.performance_id = tp.id
  JOIN public.team_members tm ON tm.id = tpm.team_member_id
  LEFT JOIN public.profiles p ON p.id = tm.user_id
  WHERE tp.team_id = _team_id
    AND public.is_team_member((SELECT auth.uid()), _team_id);
$$;
REVOKE EXECUTE ON FUNCTION public.get_team_performance_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_performance_staff(uuid) TO authenticated;