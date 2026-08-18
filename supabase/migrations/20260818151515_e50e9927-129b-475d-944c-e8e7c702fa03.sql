-- 1) Freeze the original deadline on demands
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS original_due_date timestamptz;

UPDATE public.demands SET original_due_date = due_date WHERE original_due_date IS NULL;

CREATE OR REPLACE FUNCTION public.freeze_demand_original_due_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.original_due_date IS NULL THEN
      NEW.original_due_date := NEW.due_date;
    END IF;
    RETURN NEW;
  END IF;

  -- Never allow the original deadline to be rewritten once set
  IF OLD.original_due_date IS NOT NULL THEN
    NEW.original_due_date := OLD.original_due_date;
  ELSIF NEW.original_due_date IS NULL THEN
    NEW.original_due_date := OLD.due_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_demand_original_due_date ON public.demands;
CREATE TRIGGER trg_freeze_demand_original_due_date
BEFORE INSERT OR UPDATE ON public.demands
FOR EACH ROW EXECUTE FUNCTION public.freeze_demand_original_due_date();

-- 2) History of deadline changes
CREATE TABLE IF NOT EXISTS public.demand_due_date_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  previous_due_date timestamptz,
  new_due_date timestamptz,
  reason text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demand_due_date_changes_demand ON public.demand_due_date_changes(demand_id, created_at DESC);

GRANT SELECT, INSERT ON public.demand_due_date_changes TO authenticated;
GRANT ALL ON public.demand_due_date_changes TO service_role;

ALTER TABLE public.demand_due_date_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Board members can view deadline history" ON public.demand_due_date_changes;
CREATE POLICY "Board members can view deadline history"
ON public.demand_due_date_changes FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.demands d
  WHERE d.id = demand_due_date_changes.demand_id
    AND public.is_board_member(auth.uid(), d.board_id)
));

DROP POLICY IF EXISTS "Board members can log deadline changes" ON public.demand_due_date_changes;
CREATE POLICY "Board members can log deadline changes"
ON public.demand_due_date_changes FOR INSERT TO authenticated
WITH CHECK (
  changed_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.demands d
    WHERE d.id = demand_due_date_changes.demand_id
      AND public.is_board_member(auth.uid(), d.board_id)
  )
);

-- 3) Automatic logging of every deadline change
CREATE OR REPLACE FUNCTION public.log_demand_due_date_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
BEGIN
  IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
    v_reason := nullif(current_setting('soma.reschedule_reason', true), '');
    INSERT INTO public.demand_due_date_changes (demand_id, previous_due_date, new_due_date, reason, changed_by)
    VALUES (NEW.id, OLD.due_date, NEW.due_date, v_reason, auth.uid());
    PERFORM set_config('soma.reschedule_reason', '', true);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_demand_due_date_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_demand_due_date_change ON public.demands;
CREATE TRIGGER trg_log_demand_due_date_change
AFTER UPDATE OF due_date ON public.demands
FOR EACH ROW EXECUTE FUNCTION public.log_demand_due_date_change();

-- 4) RPC used by the app/MCP to reschedule with a justification
CREATE OR REPLACE FUNCTION public.reschedule_demand(
  p_demand_id uuid,
  p_new_due_date timestamptz,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demand public.demands;
  v_changes integer;
BEGIN
  SELECT * INTO v_demand FROM public.demands WHERE id = p_demand_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demanda não encontrada';
  END IF;

  IF NOT public.is_board_member(auth.uid(), v_demand.board_id) THEN
    RAISE EXCEPTION 'Sem permissão para alterar o prazo desta demanda';
  END IF;

  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Informe a justificativa da mudança de prazo';
  END IF;

  PERFORM set_config('soma.reschedule_reason', btrim(p_reason), true);

  UPDATE public.demands
  SET due_date = p_new_due_date, updated_at = now()
  WHERE id = p_demand_id;

  SELECT count(*) INTO v_changes FROM public.demand_due_date_changes WHERE demand_id = p_demand_id;

  RETURN jsonb_build_object(
    'demand_id', p_demand_id,
    'original_due_date', (SELECT original_due_date FROM public.demands WHERE id = p_demand_id),
    'new_due_date', p_new_due_date,
    'reschedule_count', v_changes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_demand(uuid, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_demand(uuid, timestamptz, text) TO authenticated, service_role;