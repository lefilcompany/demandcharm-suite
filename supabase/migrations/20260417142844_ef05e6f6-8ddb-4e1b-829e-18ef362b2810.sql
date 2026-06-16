-- Drop old restrictive policies
DROP POLICY IF EXISTS "Board members can add assignees" ON public.demand_assignees;
DROP POLICY IF EXISTS "Board members can remove assignees" ON public.demand_assignees;

-- Allow admins, moderators, demand creators, and current assignees to add new assignees
CREATE POLICY "Admins moderators and current assignees can add"
ON public.demand_assignees
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.demands d
    JOIN public.board_members bm ON bm.board_id = d.board_id
    WHERE d.id = demand_assignees.demand_id
      AND bm.user_id = auth.uid()
      AND (
        bm.role IN ('admin'::team_role, 'moderator'::team_role)
        OR d.created_by = auth.uid()
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.demand_assignees existing
    WHERE existing.demand_id = demand_assignees.demand_id
      AND existing.user_id = auth.uid()
  )
);

-- Allow admins, moderators, demand creators, and current assignees to remove assignees
CREATE POLICY "Admins moderators and current assignees can remove"
ON public.demand_assignees
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.demands d
    JOIN public.board_members bm ON bm.board_id = d.board_id
    WHERE d.id = demand_assignees.demand_id
      AND bm.user_id = auth.uid()
      AND (
        bm.role IN ('admin'::team_role, 'moderator'::team_role)
        OR d.created_by = auth.uid()
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.demand_assignees existing
    WHERE existing.demand_id = demand_assignees.demand_id
      AND existing.user_id = auth.uid()
  )
);