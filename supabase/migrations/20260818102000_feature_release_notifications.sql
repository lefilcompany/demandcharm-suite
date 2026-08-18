-- Tracks product feature announcements published by system admins.
-- Delivery happens through the existing notifications table + send-email Edge Function.
CREATE TABLE IF NOT EXISTS public.feature_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
  action_path text NOT NULL DEFAULT '/' CHECK (char_length(action_path) <= 500),
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  inapp_recipient_count integer NOT NULL DEFAULT 0 CHECK (inapp_recipient_count >= 0),
  email_recipient_count integer NOT NULL DEFAULT 0 CHECK (email_recipient_count >= 0),
  email_success_count integer NOT NULL DEFAULT 0 CHECK (email_success_count >= 0),
  email_skipped_count integer NOT NULL DEFAULT 0 CHECK (email_skipped_count >= 0),
  email_failure_count integer NOT NULL DEFAULT 0 CHECK (email_failure_count >= 0)
);

ALTER TABLE public.feature_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view feature releases" ON public.feature_releases;
CREATE POLICY "Admins can view feature releases"
ON public.feature_releases
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS feature_releases_published_at_idx
  ON public.feature_releases (published_at DESC);

COMMENT ON TABLE public.feature_releases IS
  'Audit trail for product feature announcements distributed by email and in-app notifications.';
