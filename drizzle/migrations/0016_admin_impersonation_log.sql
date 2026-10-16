CREATE TABLE public.admin_impersonation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  target_email text,
  reason text,
  ip text,
  user_agent text,
  started_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_impersonation_log TO authenticated;
GRANT ALL ON public.admin_impersonation_log TO service_role;
ALTER TABLE public.admin_impersonation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System admins read impersonation log" ON public.admin_impersonation_log
  FOR SELECT TO authenticated USING (public.has_role((select auth.uid()), 'admin'));
CREATE INDEX idx_admin_impersonation_log_started ON public.admin_impersonation_log (started_at DESC);