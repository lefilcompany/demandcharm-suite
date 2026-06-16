
CREATE POLICY "Users allowed can update demand assignees"
ON public.demand_assignees
FOR UPDATE
TO authenticated
USING (can_manage_demand_assignees(auth.uid(), demand_id))
WITH CHECK (can_manage_demand_assignees(auth.uid(), demand_id));

CREATE OR REPLACE FUNCTION public.can_manage_demand_assignees(_user_id uuid, _demand_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.demands d
    LEFT JOIN public.board_members bm
      ON bm.board_id = d.board_id
     AND bm.user_id = _user_id
    WHERE d.id = _demand_id
      AND (
        d.created_by = _user_id
        OR bm.role IN ('admin', 'moderator', 'executor')
        OR EXISTS (
          SELECT 1
          FROM public.demand_assignees da
          WHERE da.demand_id = _demand_id
            AND da.user_id = _user_id
        )
      )
  );
$function$;
