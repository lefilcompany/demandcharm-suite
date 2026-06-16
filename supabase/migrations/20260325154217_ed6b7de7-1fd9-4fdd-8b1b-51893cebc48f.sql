
-- Add channel column to demand_interactions
ALTER TABLE public.demand_interactions 
ADD COLUMN channel text NOT NULL DEFAULT 'general';

-- Create index for channel filtering
CREATE INDEX idx_demand_interactions_channel ON public.demand_interactions(demand_id, channel);

-- Create security definer function to check if user can view internal channel
CREATE OR REPLACE FUNCTION public.can_view_demand_channel(_user_id uuid, _demand_id uuid, _channel text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _channel = 'general' THEN true
    WHEN _channel = 'internal' THEN
      EXISTS (
        SELECT 1
        FROM public.demands d
        JOIN public.board_members bm ON bm.board_id = d.board_id AND bm.user_id = _user_id
        WHERE d.id = _demand_id
        AND bm.role IN ('admin', 'moderator', 'executor')
      )
    ELSE false
  END
$$;

-- Drop existing SELECT policies on demand_interactions to replace with channel-aware one
DROP POLICY IF EXISTS "Users can view interactions for demands they can access" ON public.demand_interactions;
DROP POLICY IF EXISTS "Team members can view demand interactions" ON public.demand_interactions;
DROP POLICY IF EXISTS "Board members can view demand interactions" ON public.demand_interactions;

-- Create new channel-aware SELECT policy
CREATE POLICY "Channel-aware interaction visibility"
ON public.demand_interactions
FOR SELECT
TO authenticated
USING (
  public.can_view_demand_channel(auth.uid(), demand_id, channel)
);
