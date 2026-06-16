-- Fix shared demand links for both anonymous and authenticated sessions
-- Users logged in but not members should still be able to open valid shared links

ALTER POLICY "Public can verify share tokens"
ON public.demand_share_tokens
TO anon, authenticated;

ALTER POLICY "Anonymous can view shared demands"
ON public.demands
TO anon, authenticated;

ALTER POLICY "Anonymous can view interactions for shared demands"
ON public.demand_interactions
TO anon, authenticated;

ALTER POLICY "Anonymous can view attachments for shared demands"
ON public.demand_attachments
TO anon, authenticated;

ALTER POLICY "Anonymous can view assignees for shared demands"
ON public.demand_assignees
TO anon, authenticated;

ALTER POLICY "Anonymous can view profiles for shared demands"
ON public.profiles
TO anon, authenticated;

ALTER POLICY "Anonymous can view team basic info for shared demands"
ON public.teams
TO anon, authenticated;

ALTER POLICY "Anonymous can view services for shared demands"
ON public.services
TO anon, authenticated;