-- 1) Add sort_order column for subdemand ordering
ALTER TABLE public.demands
ADD COLUMN IF NOT EXISTS subdemand_sort_order INTEGER;

-- 2) Backfill existing subdemands by created_at order within each parent
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY parent_demand_id ORDER BY created_at ASC) AS rn
  FROM public.demands
  WHERE parent_demand_id IS NOT NULL
)
UPDATE public.demands d
SET subdemand_sort_order = ordered.rn
FROM ordered
WHERE d.id = ordered.id
  AND (d.subdemand_sort_order IS NULL);

-- 3) Index to speed up ordered fetch
CREATE INDEX IF NOT EXISTS idx_demands_parent_sort
  ON public.demands (parent_demand_id, subdemand_sort_order)
  WHERE parent_demand_id IS NOT NULL;

-- 4) RPC to reorder subdemands atomically
CREATE OR REPLACE FUNCTION public.reorder_subdemands(
  p_parent_id UUID,
  p_ordered_ids UUID[]
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_parent RECORD;
  v_can_edit BOOLEAN;
  v_id UUID;
  v_idx INTEGER := 1;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, board_id, created_by INTO v_parent
  FROM public.demands WHERE id = p_parent_id;

  IF v_parent IS NULL THEN
    RAISE EXCEPTION 'Parent demand not found';
  END IF;

  -- Permission: board admin/moderator OR creator OR current assignee
  SELECT (
    public.is_board_admin_or_moderator(v_user_id, v_parent.board_id)
    OR v_parent.created_by = v_user_id
    OR EXISTS (
      SELECT 1 FROM public.demand_assignees
      WHERE demand_id = p_parent_id AND user_id = v_user_id
    )
  ) INTO v_can_edit;

  IF NOT v_can_edit THEN
    RAISE EXCEPTION 'Permission denied to reorder subdemands';
  END IF;

  -- Apply new ordering
  FOREACH v_id IN ARRAY p_ordered_ids LOOP
    UPDATE public.demands
    SET subdemand_sort_order = v_idx
    WHERE id = v_id AND parent_demand_id = p_parent_id;
    v_idx := v_idx + 1;
  END LOOP;
END;
$$;

-- 5) Default sort_order for new subdemands (next position)
CREATE OR REPLACE FUNCTION public.set_subdemand_sort_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_demand_id IS NOT NULL AND NEW.subdemand_sort_order IS NULL THEN
    SELECT COALESCE(MAX(subdemand_sort_order), 0) + 1
    INTO NEW.subdemand_sort_order
    FROM public.demands
    WHERE parent_demand_id = NEW.parent_demand_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_subdemand_sort_order ON public.demands;
CREATE TRIGGER trg_set_subdemand_sort_order
BEFORE INSERT ON public.demands
FOR EACH ROW
EXECUTE FUNCTION public.set_subdemand_sort_order();