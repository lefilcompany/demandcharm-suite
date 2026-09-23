CREATE TABLE IF NOT EXISTS public.board_cache_versions (
  board_id uuid PRIMARY KEY,
  demands_version bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.board_cache_versions TO authenticated;
GRANT ALL ON public.board_cache_versions TO service_role;

ALTER TABLE public.board_cache_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros do quadro leem a versao" ON public.board_cache_versions;
CREATE POLICY "Membros do quadro leem a versao"
ON public.board_cache_versions
FOR SELECT
TO authenticated
USING (public.is_board_member(board_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.bump_board_demands_version(_board_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.board_cache_versions (board_id, demands_version, updated_at)
  VALUES (_board_id, 1, now())
  ON CONFLICT (board_id)
  DO UPDATE SET demands_version = public.board_cache_versions.demands_version + 1,
                updated_at = now();
$$;

CREATE OR REPLACE FUNCTION public.trg_bump_demands_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _board uuid;
BEGIN
  IF TG_TABLE_NAME = 'demands' THEN
    IF TG_OP = 'DELETE' THEN
      PERFORM public.bump_board_demands_version(OLD.board_id);
    ELSE
      PERFORM public.bump_board_demands_version(NEW.board_id);
      IF TG_OP = 'UPDATE' AND OLD.board_id IS DISTINCT FROM NEW.board_id THEN
        PERFORM public.bump_board_demands_version(OLD.board_id);
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'demand_assignees' THEN
    SELECT d.board_id INTO _board
    FROM public.demands d
    WHERE d.id = COALESCE(NEW.demand_id, OLD.demand_id);
    IF _board IS NOT NULL THEN
      PERFORM public.bump_board_demands_version(_board);
    END IF;
  ELSIF TG_TABLE_NAME = 'board_statuses' THEN
    PERFORM public.bump_board_demands_version(COALESCE(NEW.board_id, OLD.board_id));
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS bump_demands_version_on_demands ON public.demands;
CREATE TRIGGER bump_demands_version_on_demands
AFTER INSERT OR UPDATE OR DELETE ON public.demands
FOR EACH ROW EXECUTE FUNCTION public.trg_bump_demands_version();

DROP TRIGGER IF EXISTS bump_demands_version_on_assignees ON public.demand_assignees;
CREATE TRIGGER bump_demands_version_on_assignees
AFTER INSERT OR UPDATE OR DELETE ON public.demand_assignees
FOR EACH ROW EXECUTE FUNCTION public.trg_bump_demands_version();

DROP TRIGGER IF EXISTS bump_demands_version_on_board_statuses ON public.board_statuses;
CREATE TRIGGER bump_demands_version_on_board_statuses
AFTER INSERT OR UPDATE OR DELETE ON public.board_statuses
FOR EACH ROW EXECUTE FUNCTION public.trg_bump_demands_version();

INSERT INTO public.board_cache_versions (board_id, demands_version)
SELECT b.id, 1 FROM public.boards b
ON CONFLICT (board_id) DO NOTHING;