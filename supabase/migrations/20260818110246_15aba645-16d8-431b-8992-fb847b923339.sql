CREATE TABLE public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text,
  template_name text NOT NULL DEFAULT 'notification',
  event_type text NOT NULL DEFAULT 'generic',
  dedupe_key text,
  recipient_email text NOT NULL,
  recipient_user_id uuid,
  subject text NOT NULL,
  status text NOT NULL,
  source_function text,
  related_entity_type text,
  related_entity_id text,
  triggered_by uuid,
  provider_message_id text,
  http_status integer,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_send_log_status_check CHECK (status IN ('sent','skipped_duplicate','skipped_preference','failed'))
);

GRANT SELECT ON public.email_send_log TO authenticated;
GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global admins can read email send log"
ON public.email_send_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_email_send_log_dedupe ON public.email_send_log(dedupe_key, recipient_email, created_at DESC);
CREATE INDEX idx_email_send_log_created_at ON public.email_send_log(created_at DESC);
CREATE INDEX idx_email_send_log_event_type ON public.email_send_log(event_type);
CREATE INDEX idx_email_send_log_message_id ON public.email_send_log(message_id);