DROP POLICY IF EXISTS "Admins moderators and current assignees can add" ON public.demand_assignees;

CREATE POLICY "Admins moderators creators and current assignees can add"
ON public.demand_assignees
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.demands d
    LEFT JOIN public.board_members bm
      ON bm.board_id = d.board_id
     AND bm.user_id = auth.uid()
    WHERE d.id = demand_assignees.demand_id
      AND (
        d.created_by = auth.uid()
        OR bm.role IN ('admin', 'moderator')
        OR EXISTS (
          SELECT 1
          FROM public.demand_assignees existing
          WHERE existing.demand_id = demand_assignees.demand_id
            AND existing.user_id = auth.uid()
        )
      )
  )
);