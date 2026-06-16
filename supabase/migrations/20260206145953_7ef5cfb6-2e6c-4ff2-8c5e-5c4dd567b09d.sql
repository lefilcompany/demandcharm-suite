
-- ============================================================
-- FIX 1: Restrict anonymous access to teams table columns
-- Prevents exposure of access_code to anonymous users
-- ============================================================

-- Remove all privileges from anon on teams (was full access including access_code)
REVOKE ALL ON public.teams FROM anon;

-- Grant SELECT only on safe columns (excludes access_code and created_by)
GRANT SELECT (id, name, description, created_at, updated_at, 
              contract_start_date, contract_end_date, monthly_demand_limit, 
              active, scope_description) ON public.teams TO anon;

-- Drop the redundant anonymous policy (the other policy already covers shared demands + notes)
DROP POLICY IF EXISTS "Anonymous can view teams for shared demands" ON public.teams;


-- ============================================================
-- FIX 2: Restrict anonymous access to profiles table columns  
-- Prevents exposure of trial_ends_at, bio, location, social URLs
-- ============================================================

-- Remove all privileges from anon on profiles (was full access)
REVOKE ALL ON public.profiles FROM anon;

-- Grant SELECT only on public-facing columns needed for shared views
GRANT SELECT (id, full_name, avatar_url, created_at) ON public.profiles TO anon;

-- Fix the overly broad role on the shared notes profile policy
-- Was using 'public' role (ALL roles); should be 'anon' only
DROP POLICY IF EXISTS "Anonymous can view profiles for shared notes" ON public.profiles;
CREATE POLICY "Anonymous can view profiles for shared notes"
  ON public.profiles FOR SELECT TO anon
  USING (id IN (SELECT n.created_by FROM notes n WHERE is_note_shared(n.id)));
