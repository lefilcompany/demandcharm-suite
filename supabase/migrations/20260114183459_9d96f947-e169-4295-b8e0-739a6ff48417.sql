-- Add UPDATE policy for demand_share_tokens
CREATE POLICY "Board members can update share tokens"
ON public.demand_share_tokens
FOR UPDATE
USING (
  demand_id IN (
    SELECT d.id 
    FROM demands d
    WHERE d.board_id IN (SELECT get_user_board_ids(auth.uid()))
  )
)
WITH CHECK (
  demand_id IN (
    SELECT d.id 
    FROM demands d
    WHERE d.board_id IN (SELECT get_user_board_ids(auth.uid()))
  )
);