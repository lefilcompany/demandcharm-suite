
-- Revert the problematic realtime.messages changes from previous migration
-- (realtime is a reserved schema and should not be modified)
-- This is a no-op if the previous migration failed to apply

-- Re-ensure the valid security fixes are idempotent (safe to re-run)

-- Fix: team_members self-join role restriction (idempotent)
DROP POLICY IF EXISTS "Users can join teams with access code" ON public.team_members;
CREATE POLICY "Users can join teams with access code"
  ON public.team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'requester'::team_role
  );

-- Fix: Storage upload policy (idempotent)
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

-- Fix: Webhook subscription policies (idempotent)
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

-- Fix: Usage records policies (idempotent)
DROP POLICY IF EXISTS "System can insert usage records" ON public.usage_records;
DROP POLICY IF EXISTS "System can update usage records" ON public.usage_records;
DROP POLICY IF EXISTS "Admins can insert usage records" ON public.usage_records;
DROP POLICY IF EXISTS "Admins can update usage records" ON public.usage_records;

CREATE POLICY "Admins can insert usage records"
  ON public.usage_records FOR INSERT TO authenticated
  WITH CHECK (is_team_admin(auth.uid(), team_id));

CREATE POLICY "Admins can update usage records"
  ON public.usage_records FOR UPDATE TO authenticated
  USING (is_team_admin(auth.uid(), team_id))
  WITH CHECK (is_team_admin(auth.uid(), team_id));
