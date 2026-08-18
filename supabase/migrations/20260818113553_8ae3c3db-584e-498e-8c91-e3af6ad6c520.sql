CREATE OR REPLACE FUNCTION public.increment_release_delivery_attempts(p_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.release_deliveries
     SET attempts = attempts + 1
   WHERE id = ANY(p_ids);
$$;

REVOKE ALL ON FUNCTION public.increment_release_delivery_attempts(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_release_delivery_attempts(uuid[]) TO service_role;