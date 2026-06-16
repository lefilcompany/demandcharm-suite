CREATE OR REPLACE FUNCTION public.can_manage_demand_assignees(_user_id uuid, _demand_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.demands d
    LEFT JOIN public.board_members bm
      ON bm.board_id = d.board_id
     AND bm.user_id = _user_id
    WHERE d.id = _demand_id
      AND (
        d.created_by = _user_id
        OR bm.role IN ('admin', 'moderator')
        OR EXISTS (
          SELECT 1
          FROM public.demand_assignees da
          WHERE da.demand_id = _demand_id
            AND da.user_id = _user_id
        )
      )
  );
$$;

DROP POLICY IF EXISTS "Admins moderators creators and current assignees can add" ON public.demand_assignees;
DROP POLICY IF EXISTS "Admins moderators and current assignees can remove" ON public.demand_assignees;

CREATE POLICY "Users allowed can add demand assignees"
ON public.demand_assignees
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_demand_assignees(auth.uid(), demand_id));

CREATE POLICY "Users allowed can remove demand assignees"
ON public.demand_assignees
FOR DELETE
TO authenticated
USING (public.can_manage_demand_assignees(auth.uid(), demand_id));