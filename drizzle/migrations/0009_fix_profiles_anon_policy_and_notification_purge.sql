DROP POLICY IF EXISTS "Anonymous can view profiles for shared demands" ON public.profiles;

CREATE POLICY "Anonymous can view profiles for shared demands"
ON public.profiles
FOR SELECT
TO anon
USING (
  (id IN (
    SELECT d.created_by FROM public.demands d WHERE public.is_demand_shared(d.id)
    UNION
    SELECT da.user_id FROM public.demand_assignees da
      JOIN public.demands d ON d.id = da.demand_id
      WHERE public.is_demand_shared(d.id)
    UNION
    SELECT di.user_id FROM public.demand_interactions di
      JOIN public.demands d ON d.id = di.demand_id
      WHERE public.is_demand_shared(d.id)
  ))
  OR (id IN (SELECT n.created_by FROM public.notes n WHERE public.is_note_shared(n.id)))
);

CREATE OR REPLACE FUNCTION public.purge_old_read_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.notifications
  WHERE read = true
    AND created_at < now() - interval '60 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;