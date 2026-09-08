ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS trash_expires_at timestamptz;

UPDATE public.demands
SET trash_expires_at = now() + interval '30 days',
    archived_at = coalesce(archived_at, now())
WHERE archived = true AND trash_expires_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_demand_trash_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.archived = true AND (TG_OP = 'INSERT' OR OLD.archived IS DISTINCT FROM true) THEN
    NEW.archived_at := coalesce(NEW.archived_at, now());
    NEW.trash_expires_at := now() + interval '30 days';
  ELSIF NEW.archived = false THEN
    NEW.archived_at := NULL;
    NEW.trash_expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_demand_trash_fields ON public.demands;
CREATE TRIGGER trg_set_demand_trash_fields
BEFORE INSERT OR UPDATE OF archived ON public.demands
FOR EACH ROW EXECUTE FUNCTION public.set_demand_trash_fields();

CREATE OR REPLACE FUNCTION public.purge_expired_trashed_demands()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  WITH del AS (
    DELETE FROM public.demands
    WHERE archived = true
      AND trash_expires_at IS NOT NULL
      AND trash_expires_at < now()
    RETURNING id
  )
  SELECT count(*) INTO n FROM del;
  RETURN coalesce(n, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_trashed_demands() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_trashed_demands() TO service_role;

SELECT cron.schedule(
  'purge-trashed-demands-daily',
  '30 3 * * *',
  $$select public.purge_expired_trashed_demands();$$
);

GRANT DELETE ON public.demands TO authenticated;

DROP POLICY IF EXISTS "Board members can delete trashed demands" ON public.demands;
CREATE POLICY "Board members can delete trashed demands"
ON public.demands
FOR DELETE
TO authenticated
USING (
  archived = true
  AND board_id IN (SELECT public.get_user_board_ids(auth.uid()))
);