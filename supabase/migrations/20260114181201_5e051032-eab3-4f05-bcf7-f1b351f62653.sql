-- Create table for demand share tokens
CREATE TABLE public.demand_share_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create index for faster token lookups
CREATE INDEX idx_demand_share_tokens_token ON public.demand_share_tokens(token);
CREATE INDEX idx_demand_share_tokens_demand_id ON public.demand_share_tokens(demand_id);

-- Enable RLS
ALTER TABLE public.demand_share_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Board members can create share tokens for their demands
CREATE POLICY "Board members can create share tokens"
ON public.demand_share_tokens
FOR INSERT
WITH CHECK (
  demand_id IN (
    SELECT d.id FROM demands d 
    WHERE d.board_id IN (SELECT get_user_board_ids(auth.uid()))
  )
);

-- Policy: Board members can view their share tokens
CREATE POLICY "Board members can view share tokens"
ON public.demand_share_tokens
FOR SELECT
USING (
  demand_id IN (
    SELECT d.id FROM demands d 
    WHERE d.board_id IN (SELECT get_user_board_ids(auth.uid()))
  )
);

-- Policy: Board members can delete their share tokens
CREATE POLICY "Board members can delete share tokens"
ON public.demand_share_tokens
FOR DELETE
USING (
  demand_id IN (
    SELECT d.id FROM demands d 
    WHERE d.board_id IN (SELECT get_user_board_ids(auth.uid()))
  )
);

-- Policy: Anyone can read valid share tokens (for public access verification)
CREATE POLICY "Anyone can verify share tokens"
ON public.demand_share_tokens
FOR SELECT
USING (
  is_active = true 
  AND (expires_at IS NULL OR expires_at > now())
);

-- Add policy to demands table for public view with valid share token
CREATE POLICY "Anyone can view shared demands"
ON public.demands
FOR SELECT
USING (
  id IN (
    SELECT dst.demand_id 
    FROM demand_share_tokens dst 
    WHERE dst.is_active = true 
    AND (dst.expires_at IS NULL OR dst.expires_at > now())
  )
);

-- Add policy to demand_statuses for anonymous access (needed for public view)
-- Already has "Anyone can view statuses" policy

-- Add policy to services for anonymous access via shared demands
CREATE POLICY "Anyone can view services for shared demands"
ON public.services
FOR SELECT
USING (
  id IN (
    SELECT d.service_id 
    FROM demands d
    WHERE d.id IN (
      SELECT dst.demand_id 
      FROM demand_share_tokens dst 
      WHERE dst.is_active = true 
      AND (dst.expires_at IS NULL OR dst.expires_at > now())
    )
  )
);

-- Add policy to profiles for anonymous access via shared demands (for creator info)
CREATE POLICY "Anyone can view profiles for shared demands"
ON public.profiles
FOR SELECT
USING (
  id IN (
    SELECT d.created_by 
    FROM demands d
    WHERE d.id IN (
      SELECT dst.demand_id 
      FROM demand_share_tokens dst 
      WHERE dst.is_active = true 
      AND (dst.expires_at IS NULL OR dst.expires_at > now())
    )
  )
);

-- Add policy to teams for anonymous access via shared demands
CREATE POLICY "Anyone can view teams for shared demands"
ON public.teams
FOR SELECT
USING (
  id IN (
    SELECT d.team_id 
    FROM demands d
    WHERE d.id IN (
      SELECT dst.demand_id 
      FROM demand_share_tokens dst 
      WHERE dst.is_active = true 
      AND (dst.expires_at IS NULL OR dst.expires_at > now())
    )
  )
);

-- Add policy to demand_interactions for anonymous access via shared demands
CREATE POLICY "Anyone can view interactions for shared demands"
ON public.demand_interactions
FOR SELECT
USING (
  demand_id IN (
    SELECT dst.demand_id 
    FROM demand_share_tokens dst 
    WHERE dst.is_active = true 
    AND (dst.expires_at IS NULL OR dst.expires_at > now())
  )
);

-- Add policy to demand_assignees for anonymous access via shared demands
CREATE POLICY "Anyone can view assignees for shared demands"
ON public.demand_assignees
FOR SELECT
USING (
  demand_id IN (
    SELECT dst.demand_id 
    FROM demand_share_tokens dst 
    WHERE dst.is_active = true 
    AND (dst.expires_at IS NULL OR dst.expires_at > now())
  )
);

-- Add policy to demand_attachments for anonymous access via shared demands
CREATE POLICY "Anyone can view attachments for shared demands"
ON public.demand_attachments
FOR SELECT
USING (
  demand_id IN (
    SELECT dst.demand_id 
    FROM demand_share_tokens dst 
    WHERE dst.is_active = true 
    AND (dst.expires_at IS NULL OR dst.expires_at > now())
  )
);