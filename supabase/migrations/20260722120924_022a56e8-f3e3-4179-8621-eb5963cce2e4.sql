CREATE TABLE public.test_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  scenario TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_message_id TEXT,
  http_status INTEGER,
  error_message TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_test_email_log_created_at ON public.test_email_log (created_at DESC);
GRANT SELECT ON public.test_email_log TO authenticated;
GRANT ALL ON public.test_email_log TO service_role;
ALTER TABLE public.test_email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System admins can view test email log" ON public.test_email_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));