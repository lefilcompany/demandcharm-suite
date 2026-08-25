REVOKE ALL ON public.google_calendar_rollout_users FROM anon, authenticated;
REVOKE ALL ON public.google_calendar_tokens FROM anon, authenticated;
GRANT ALL ON public.google_calendar_rollout_users TO service_role;
GRANT ALL ON public.google_calendar_tokens TO service_role;