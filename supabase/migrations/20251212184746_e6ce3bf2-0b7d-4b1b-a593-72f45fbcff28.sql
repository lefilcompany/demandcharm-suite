-- Add UPDATE and DELETE policies for demand_interactions
-- Users can update their own comments
CREATE POLICY "Users can update own interactions"
ON public.demand_interactions
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own interactions"
ON public.demand_interactions
FOR DELETE
USING (auth.uid() = user_id);