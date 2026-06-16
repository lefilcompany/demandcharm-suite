-- Drop the conflicting policies that are causing infinite recursion
DROP POLICY IF EXISTS "Anyone can verify share tokens" ON public.demand_share_tokens;
DROP POLICY IF EXISTS "Anyone can view shared demands" ON public.demands;
DROP POLICY IF EXISTS "Anyone can view services for shared demands" ON public.services;
DROP POLICY IF EXISTS "Anyone can view profiles for shared demands" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view teams for shared demands" ON public.teams;
DROP POLICY IF EXISTS "Anyone can view interactions for shared demands" ON public.demand_interactions;
DROP POLICY IF EXISTS "Anyone can view assignees for shared demands" ON public.demand_assignees;
DROP POLICY IF EXISTS "Anyone can view attachments for shared demands" ON public.demand_attachments;

-- Recreate the policy for demand_share_tokens to avoid recursion
-- Use a simpler approach that doesn't reference other tables in a circular way
CREATE POLICY "Public can verify share tokens"
ON public.demand_share_tokens
FOR SELECT
TO anon
USING (
  is_active = true 
  AND (expires_at IS NULL OR expires_at > now())
);

-- For public access to demands via share token, we need to use a function to break the recursion
CREATE OR REPLACE FUNCTION public.is_demand_shared(demand_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM demand_share_tokens dst 
    WHERE dst.demand_id = demand_id_param
    AND dst.is_active = true 
    AND (dst.expires_at IS NULL OR dst.expires_at > now())
  );
$$;

-- Add policy to demands table for public view with valid share token
CREATE POLICY "Anonymous can view shared demands"
ON public.demands
FOR SELECT
TO anon
USING (is_demand_shared(id));

-- Add policy to services for anonymous access via shared demands
CREATE POLICY "Anonymous can view services for shared demands"
ON public.services
FOR SELECT
TO anon
USING (
  id IN (
    SELECT d.service_id 
    FROM demands d
    WHERE is_demand_shared(d.id)
  )
);

-- Add policy to profiles for anonymous access via shared demands (for creator info)
CREATE POLICY "Anonymous can view profiles for shared demands"
ON public.profiles
FOR SELECT
TO anon
USING (
  id IN (
    SELECT d.created_by 
    FROM demands d
    WHERE is_demand_shared(d.id)
  )
  OR
  id IN (
    SELECT da.user_id 
    FROM demand_assignees da
    JOIN demands d ON da.demand_id = d.id
    WHERE is_demand_shared(d.id)
  )
);

-- Add policy to teams for anonymous access via shared demands
CREATE POLICY "Anonymous can view teams for shared demands"
ON public.teams
FOR SELECT
TO anon
USING (
  id IN (
    SELECT d.team_id 
    FROM demands d
    WHERE is_demand_shared(d.id)
  )
);

-- Add policy to demand_interactions for anonymous access via shared demands
CREATE POLICY "Anonymous can view interactions for shared demands"
ON public.demand_interactions
FOR SELECT
TO anon
USING (is_demand_shared(demand_id));

-- Add policy to demand_assignees for anonymous access via shared demands
CREATE POLICY "Anonymous can view assignees for shared demands"
ON public.demand_assignees
FOR SELECT
TO anon
USING (is_demand_shared(demand_id));

-- Add policy to demand_attachments for anonymous access via shared demands
CREATE POLICY "Anonymous can view attachments for shared demands"
ON public.demand_attachments
FOR SELECT
TO anon
USING (is_demand_shared(demand_id));