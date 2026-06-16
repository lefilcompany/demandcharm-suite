-- Fix demand_statuses RLS policies for board admins/moderators
-- Ensure function argument order is (user_id, board_id)

DROP POLICY IF EXISTS "Board admins can create custom statuses for their board" ON public.demand_statuses;
DROP POLICY IF EXISTS "Board admins can delete custom statuses from their board" ON public.demand_statuses;
DROP POLICY IF EXISTS "Board admins can update custom statuses" ON public.demand_statuses;

CREATE POLICY "Board admins can create custom statuses for their board"
ON public.demand_statuses
FOR INSERT
TO authenticated
WITH CHECK (
  board_id IS NOT NULL
  AND public.is_board_admin_or_moderator(auth.uid(), board_id)
);

CREATE POLICY "Board admins can delete custom statuses from their board"
ON public.demand_statuses
FOR DELETE
TO authenticated
USING (
  is_system = false
  AND board_id IS NOT NULL
  AND public.is_board_admin_or_moderator(auth.uid(), board_id)
);

CREATE POLICY "Board admins can update custom statuses"
ON public.demand_statuses
FOR UPDATE
TO authenticated
USING (
  board_id IS NOT NULL
  AND public.is_board_admin_or_moderator(auth.uid(), board_id)
)
WITH CHECK (
  board_id IS NOT NULL
  AND public.is_board_admin_or_moderator(auth.uid(), board_id)
);