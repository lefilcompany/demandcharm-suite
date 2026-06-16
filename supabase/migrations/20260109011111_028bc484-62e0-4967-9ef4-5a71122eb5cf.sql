-- Allow team creators to insert themselves as admin in team_members during team creation

-- 1) Helper function (security definer) to avoid RLS cross-table surprises
CREATE OR REPLACE FUNCTION public.is_team_creator(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teams t
    WHERE t.id = _team_id
      AND t.created_by = _user_id
  );
$$;

-- 2) Policy: creator can add themself as admin
DROP POLICY IF EXISTS "Team creators can add self as admin" ON public.team_members;
CREATE POLICY "Team creators can add self as admin"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'admin'::public.team_role
  AND public.is_team_creator(auth.uid(), team_id)
);