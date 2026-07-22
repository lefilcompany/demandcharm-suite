-- Log de testes de push disparados pelo admin
CREATE TABLE IF NOT EXISTS public.test_push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by uuid NOT NULL,
  target_user_id uuid NOT NULL,
  scenario text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL,
  sent int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  skipped int NOT NULL DEFAULT 0,
  http_status int,
  error_message text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.test_push_log TO authenticated;
GRANT ALL ON public.test_push_log TO service_role;

ALTER TABLE public.test_push_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view push test log"
  ON public.test_push_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_test_push_log_created_at ON public.test_push_log (created_at DESC);
