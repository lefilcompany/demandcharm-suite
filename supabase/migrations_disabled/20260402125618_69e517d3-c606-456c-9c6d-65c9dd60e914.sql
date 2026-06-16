
-- ============================================================
-- Fix 1: PRIVILEGE_ESCALATION - team_members self-join role restriction
-- Drop the old policy and recreate with role = 'requester' enforcement
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
-- Fix 2: OVERLY_PERMISSIVE_STORAGE_UPLOAD - Remove broad upload policies
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
-- Fix 3: OVERLY_PERMISSIVE_STORAGE_READ - Remove broad read policy for request attachments
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated users to read request attachments" ON storage.objects;

-- ============================================================
-- Fix 4: WEBHOOK SECRET - Revoke direct SELECT on secret column
-- Also drop the old ALL policy if it still exists and replace with granular ones
-- ============================================================
DROP POLICY IF EXISTS "Team admins can manage API keys" ON public.webhook_subscriptions;
DROP POLICY IF EXISTS "Team admins can manage webhook subscriptions" ON public.webhook_subscriptions;
DROP POLICY IF EXISTS "Team admins can select webhook subscriptions" ON public.webhook_subscriptions;
DROP POLICY IF EXISTS "Team admins can insert webhook subscriptions" ON public.webhook_subscriptions;
DROP POLICY IF EXISTS "Team admins can update webhook subscriptions" ON public.webhook_subscriptions;
DROP POLICY IF EXISTS "Team admins can delete webhook subscriptions" ON public.webhook_subscriptions;

CREATE POLICY "Team admins can select webhook subscriptions"
  ON public.webhook_subscriptions FOR SELECT TO authenticated
  USING (is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can insert webhook subscriptions"
  ON public.webhook_subscriptions FOR INSERT TO authenticated
  WITH CHECK (is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can update webhook subscriptions"
  ON public.webhook_subscriptions FOR UPDATE TO authenticated
  USING (is_team_admin(auth.uid(), team_id))
  WITH CHECK (is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can delete webhook subscriptions"
  ON public.webhook_subscriptions FOR DELETE TO authenticated
  USING (is_team_admin(auth.uid(), team_id));

REVOKE SELECT (secret) ON public.webhook_subscriptions FROM anon, authenticated;

-- ============================================================
-- Fix 5: USAGE RECORDS - Restrict write to admins only (not all members)
-- ============================================================
DROP POLICY IF EXISTS "System can insert usage records" ON public.usage_records;
DROP POLICY IF EXISTS "System can update usage records" ON public.usage_records;

CREATE POLICY "Admins can insert usage records"
  ON public.usage_records FOR INSERT TO authenticated
  WITH CHECK (is_team_admin(auth.uid(), team_id));

CREATE POLICY "Admins can update usage records"
  ON public.usage_records FOR UPDATE TO authenticated
  USING (is_team_admin(auth.uid(), team_id))
  WITH CHECK (is_team_admin(auth.uid(), team_id));

-- ============================================================
-- Fix 6: REALTIME RLS - Add policy on realtime.messages
-- For postgres_changes, table-level RLS already protects data.
-- This adds basic channel authorization.
-- ============================================================
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can use realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can use realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);
