-- Allow users to leave teams by deleting their own membership
CREATE POLICY "Users can leave teams"
ON public.team_members
FOR DELETE
USING (auth.uid() = user_id);