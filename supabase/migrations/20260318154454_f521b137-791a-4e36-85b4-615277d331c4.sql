
CREATE POLICY "Users can delete own non-pending requests"
ON public.team_join_requests
FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND status IN ('rejected', 'approved'));
