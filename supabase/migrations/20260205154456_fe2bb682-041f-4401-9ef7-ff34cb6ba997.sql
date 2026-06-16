-- Fix 1: Remove overly permissive profiles policy
-- The "Authenticated users can view profiles" policy allows ANY authenticated user 
-- to view ALL profiles which exposes personal data unnecessarily.
-- The "Team members can view teammate profiles" policy already covers legitimate use cases.

DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Note: The following policies remain and provide proper access:
-- - "Anonymous can view profiles for shared demands" - for shared demand access
-- - "Anonymous can view profiles for shared notes" - for shared note access  
-- - "Team members can view teammate profiles" - for team members and board members
-- - "Users can update own profile" - for self-updates