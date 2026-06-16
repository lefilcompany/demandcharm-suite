-- Fix 1: team_members role escalation - restrict self-join to 'requester' role only
DROP POLICY IF EXISTS "Users can join teams with access code" ON public.team_members;
CREATE POLICY "Users can join teams with access code"
  ON public.team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'requester'::team_role
  );

-- Fix 2: Storage upload policy - restrict uploads to user's own folder
DROP POLICY IF EXISTS "Team members can upload to demand-attachments" ON storage.objects;
CREATE POLICY "Team members can upload to demand-attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'demand-attachments'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- Fix 3: Webhook secrets - split ALL policy and revoke secret column access
DROP POLICY IF EXISTS "Team admins can manage webhook subscriptions" ON public.webhook_subscriptions;

CREATE POLICY "Team admins can select webhook subscriptions"
  ON public.webhook_subscriptions
  FOR SELECT
  TO authenticated
  USING (is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can insert webhook subscriptions"
  ON public.webhook_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can update webhook subscriptions"
  ON public.webhook_subscriptions
  FOR UPDATE
  TO authenticated
  USING (is_team_admin(auth.uid(), team_id))
  WITH CHECK (is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can delete webhook subscriptions"
  ON public.webhook_subscriptions
  FOR DELETE
  TO authenticated
  USING (is_team_admin(auth.uid(), team_id));

-- Revoke direct column access to secret for client-side roles
REVOKE SELECT (secret) ON public.webhook_subscriptions FROM anon, authenticated;