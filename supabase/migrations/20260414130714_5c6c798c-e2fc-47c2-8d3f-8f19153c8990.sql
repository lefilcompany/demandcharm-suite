
-- 1. Add parent_demand_id to demands
ALTER TABLE public.demands ADD COLUMN parent_demand_id UUID REFERENCES public.demands(id) ON DELETE CASCADE;
CREATE INDEX idx_demands_parent ON public.demands(parent_demand_id) WHERE parent_demand_id IS NOT NULL;

-- 2. Create demand_dependencies table
CREATE TABLE public.demand_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  depends_on_demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(demand_id, depends_on_demand_id),
  CHECK(demand_id != depends_on_demand_id)
);

ALTER TABLE public.demand_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board members can manage dependencies" ON public.demand_dependencies
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.demands d
    JOIN public.board_members bm ON bm.board_id = d.board_id AND bm.user_id = auth.uid()
    WHERE d.id = demand_dependencies.demand_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.demands d
    JOIN public.board_members bm ON bm.board_id = d.board_id AND bm.user_id = auth.uid()
    WHERE d.id = demand_dependencies.demand_id
  )
);

-- 3. Transactional RPC to create demand with subdemands
CREATE OR REPLACE FUNCTION public.create_demand_with_subdemands(
  p_parent JSONB,
  p_subdemands JSONB DEFAULT '[]'::JSONB,
  p_dependencies JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_parent_id UUID;
  v_sub_ids UUID[];
  v_sub JSONB;
  v_dep JSONB;
  v_sub_id UUID;
  v_idx INTEGER;
  v_dep_idx INTEGER;
  v_depends_on_idx INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate board membership
  IF NOT public.is_board_member(v_user_id, (p_parent->>'board_id')::UUID) THEN
    RAISE EXCEPTION 'Not a board member';
  END IF;

  -- Insert parent demand
  INSERT INTO public.demands (
    title, description, team_id, board_id, status_id, priority,
    assigned_to, due_date, service_id, created_by
  ) VALUES (
    p_parent->>'title',
    p_parent->>'description',
    (p_parent->>'team_id')::UUID,
    (p_parent->>'board_id')::UUID,
    (p_parent->>'status_id')::UUID,
    COALESCE(p_parent->>'priority', 'média'),
    (p_parent->>'assigned_to')::UUID,
    (p_parent->>'due_date')::TIMESTAMPTZ,
    (p_parent->>'service_id')::UUID,
    v_user_id
  ) RETURNING id INTO v_parent_id;

  -- Insert subdemands
  v_sub_ids := ARRAY[]::UUID[];
  v_idx := 0;
  FOR v_sub IN SELECT * FROM jsonb_array_elements(p_subdemands)
  LOOP
    INSERT INTO public.demands (
      title, description, team_id, board_id, status_id, priority,
      assigned_to, due_date, service_id, created_by, parent_demand_id
    ) VALUES (
      v_sub->>'title',
      v_sub->>'description',
      (p_parent->>'team_id')::UUID,
      (p_parent->>'board_id')::UUID,
      (v_sub->>'status_id')::UUID,
      COALESCE(v_sub->>'priority', 'média'),
      (v_sub->>'assigned_to')::UUID,
      (v_sub->>'due_date')::TIMESTAMPTZ,
      (v_sub->>'service_id')::UUID,
      v_user_id,
      v_parent_id
    ) RETURNING id INTO v_sub_id;

    v_sub_ids := array_append(v_sub_ids, v_sub_id);
    v_idx := v_idx + 1;
  END LOOP;

  -- Insert dependencies (index-based: demand_index depends_on depends_on_index)
  FOR v_dep IN SELECT * FROM jsonb_array_elements(p_dependencies)
  LOOP
    v_dep_idx := (v_dep->>'demand_index')::INTEGER;
    v_depends_on_idx := (v_dep->>'depends_on_index')::INTEGER;

    IF v_dep_idx < 1 OR v_dep_idx > array_length(v_sub_ids, 1) THEN
      RAISE EXCEPTION 'Invalid demand_index: %', v_dep_idx;
    END IF;
    IF v_depends_on_idx < 1 OR v_depends_on_idx > array_length(v_sub_ids, 1) THEN
      RAISE EXCEPTION 'Invalid depends_on_index: %', v_depends_on_idx;
    END IF;

    INSERT INTO public.demand_dependencies (demand_id, depends_on_demand_id)
    VALUES (v_sub_ids[v_dep_idx], v_sub_ids[v_depends_on_idx]);
  END LOOP;

  RETURN jsonb_build_object(
    'parent_id', v_parent_id,
    'subdemand_ids', to_jsonb(v_sub_ids)
  );
END;
$$;

-- 4. Trigger to block status change if dependencies not met
CREATE OR REPLACE FUNCTION public.enforce_demand_dependency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_status_name TEXT;
  v_unmet RECORD;
BEGIN
  -- Only check if status changed
  IF OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  -- Only check subdemands (those with parent)
  IF NEW.parent_demand_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO new_status_name FROM public.demand_statuses WHERE id = NEW.status_id;

  -- Block moving to "Fazendo" if dependencies not delivered
  IF new_status_name = 'Fazendo' THEN
    SELECT d.id, d.title, ds.name AS status_name
    INTO v_unmet
    FROM public.demand_dependencies dd
    JOIN public.demands d ON d.id = dd.depends_on_demand_id
    JOIN public.demand_statuses ds ON ds.id = d.status_id
    WHERE dd.demand_id = NEW.id
      AND ds.name != 'Entregue'
    LIMIT 1;

    IF v_unmet IS NOT NULL THEN
      RAISE EXCEPTION 'Subdemanda depende de "%" que ainda não foi concluída (status: %)', v_unmet.title, v_unmet.status_name;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_dependency_status
BEFORE UPDATE ON public.demands
FOR EACH ROW
EXECUTE FUNCTION public.enforce_demand_dependency();
