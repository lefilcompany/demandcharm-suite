REVOKE ALL ON public.google_oauth_states FROM anon, authenticated;
REVOKE ALL ON public.google_calendar_connections FROM anon, authenticated;
REVOKE ALL ON public.app_feature_flags FROM anon, authenticated;
GRANT ALL ON public.google_oauth_states TO service_role;
GRANT ALL ON public.google_calendar_connections TO service_role;
GRANT ALL ON public.app_feature_flags TO service_role;