CREATE POLICY "Board members can update recurring demands"
ON public.recurring_demands
FOR UPDATE
TO authenticated
USING (board_id IN (SELECT get_user_board_ids(auth.uid())))
WITH CHECK (board_id IN (SELECT get_user_board_ids(auth.uid())));