
-- ============================================================
-- Fix 1: PRIVILEGE_ESCALATION - team_members self-join
-- Enforce role = 'requester' on self-insert
-- ============================================================
DROP POLICY IF EXISTS "Users can join teams with access code" ON public.team_members;
CREATE POLICY "Users can join teams with access code"
  ON public.team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'requester'::team_role
  );

-- ============================================================
-- Fix 2: OVERLY_PERMISSIVE_STORAGE_UPLOAD
-- Remove broad upload policies, keep only team-member-verified one
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated users to upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Team members can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Team members can upload to demand-attachments" ON storage.objects;

CREATE POLICY "Team members can upload to demand-attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'demand-attachments'
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- ============================================================
-- Fix 3: OVERLY_PERMISSIVE_STORAGE_READ
-- Remove the broad name-prefix policy, keep the join-verified one
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated users to read request attachments" ON storage.objects;

-- ============================================================
-- Fix 4: EXPOSED_SENSITIVE_DATA - webhook secrets
-- Split ALL policy into granular ones and revoke secret column
-- ============================================================
DROP POLICY IF EXISTS "Team admins can manage API keys" ON public.webhook_subscriptions;
DROP POLICY IF EXISTS "Team admins can manage webhook subscriptions" ON public.webhook_subscriptions;
DROP POLICY IF EXISTS "Team admins can select webhook subscriptions" ON public.webhook_subscriptions;
DROP POLICY IF EXISTS "Team admins can insert webhook subscriptions" ON public.webhook_subscriptions;
DROP POLICY IF EXISTS "Team admins can update webhook subscriptions" ON public.webhook_subscriptions;
DROP POLICY IF EXISTS "Team admins can delete webhook subscriptions" ON public.webhook_subscriptions;

CREATE POLICY "Team admins can select webhook subscriptions"
  ON public.webhook_subscriptions FOR SELECT TO authenticated
  USING (public.is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can insert webhook subscriptions"
  ON public.webhook_subscriptions FOR INSERT TO authenticated
  WITH CHECK (public.is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can update webhook subscriptions"
  ON public.webhook_subscriptions FOR UPDATE TO authenticated
  USING (public.is_team_admin(auth.uid(), team_id))
  WITH CHECK (public.is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can delete webhook subscriptions"
  ON public.webhook_subscriptions FOR DELETE TO authenticated
  USING (public.is_team_admin(auth.uid(), team_id));

REVOKE SELECT (secret) ON public.webhook_subscriptions FROM anon, authenticated;
