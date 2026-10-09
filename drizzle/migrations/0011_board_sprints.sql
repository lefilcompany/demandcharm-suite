CREATE TABLE public.board_sprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  goal text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','completed')),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.sprint_demands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id uuid NOT NULL REFERENCES public.board_sprints(id) ON DELETE CASCADE,
  demand_id uuid NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  added_by uuid DEFAULT auth.uid(),
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sprint_id, demand_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_sprints TO authenticated;
GRANT ALL ON public.board_sprints TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sprint_demands TO authenticated;
GRANT ALL ON public.sprint_demands TO service_role;
ALTER TABLE public.board_sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_demands ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_board_sprints_board ON public.board_sprints(board_id);
CREATE UNIQUE INDEX uq_board_sprints_one_active ON public.board_sprints(board_id) WHERE status = 'active';
CREATE INDEX idx_sprint_demands_demand ON public.sprint_demands(demand_id);
CREATE INDEX idx_sprint_demands_sprint ON public.sprint_demands(sprint_id);

CREATE OR REPLACE FUNCTION public.can_edit_board_sprints(_user_id uuid, _board_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.board_members WHERE user_id = _user_id AND board_id = _board_id AND role <> 'requester')
$$;
REVOKE EXECUTE ON FUNCTION public.can_edit_board_sprints(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_edit_board_sprints(uuid, uuid) TO authenticated;

CREATE POLICY "Members view sprints" ON public.board_sprints FOR SELECT TO authenticated
  USING (public.is_board_member((select auth.uid()), board_id));
CREATE POLICY "Executors insert sprints" ON public.board_sprints FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_board_sprints((select auth.uid()), board_id));
CREATE POLICY "Executors update sprints" ON public.board_sprints FOR UPDATE TO authenticated
  USING (public.can_edit_board_sprints((select auth.uid()), board_id))
  WITH CHECK (public.can_edit_board_sprints((select auth.uid()), board_id));
CREATE POLICY "Executors delete sprints" ON public.board_sprints FOR DELETE TO authenticated
  USING (public.can_edit_board_sprints((select auth.uid()), board_id));

CREATE POLICY "Members view sprint demands" ON public.sprint_demands FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.board_sprints s WHERE s.id = sprint_id AND public.is_board_member((select auth.uid()), s.board_id)));
CREATE POLICY "Executors insert sprint demands" ON public.sprint_demands FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.board_sprints s WHERE s.id = sprint_id AND public.can_edit_board_sprints((select auth.uid()), s.board_id)));
CREATE POLICY "Executors delete sprint demands" ON public.sprint_demands FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.board_sprints s WHERE s.id = sprint_id AND public.can_edit_board_sprints((select auth.uid()), s.board_id)));

CREATE OR REPLACE FUNCTION public.trg_validate_board_sprint()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'A data de fim deve ser igual ou posterior ao início';
  END IF;
  NEW.updated_at := now();
  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_board_sprint BEFORE INSERT OR UPDATE ON public.board_sprints
  FOR EACH ROW EXECUTE FUNCTION public.trg_validate_board_sprint();

CREATE OR REPLACE FUNCTION public.trg_validate_sprint_demand()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _board uuid; _status text;
BEGIN
  SELECT board_id, status INTO _board, _status FROM public.board_sprints WHERE id = NEW.sprint_id;
  IF _status = 'completed' THEN
    RAISE EXCEPTION 'Não é possível adicionar demandas a uma sprint concluída';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.demands WHERE id = NEW.demand_id AND board_id = _board) THEN
    RAISE EXCEPTION 'A demanda precisa ser do mesmo quadro da sprint';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sprint_demands sd JOIN public.board_sprints s ON s.id = sd.sprint_id
             WHERE sd.demand_id = NEW.demand_id AND s.status <> 'completed' AND sd.sprint_id <> NEW.sprint_id) THEN
    RAISE EXCEPTION 'Esta demanda já está em outra sprint em aberto';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.trg_validate_sprint_demand() FROM anon, public;
CREATE TRIGGER validate_sprint_demand BEFORE INSERT ON public.sprint_demands
  FOR EACH ROW EXECUTE FUNCTION public.trg_validate_sprint_demand();

CREATE OR REPLACE FUNCTION public.complete_sprint(_sprint_id uuid, _carry_to uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _board uuid; _moved integer := 0;
BEGIN
  SELECT board_id INTO _board FROM public.board_sprints WHERE id = _sprint_id;
  IF _board IS NULL OR NOT public.can_edit_board_sprints((select auth.uid()), _board) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE public.board_sprints SET status = 'completed', completed_at = now() WHERE id = _sprint_id;
  IF _carry_to IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.board_sprints WHERE id = _carry_to AND board_id = _board AND status <> 'completed') THEN
      RAISE EXCEPTION 'Sprint de destino inválida';
    END IF;
    INSERT INTO public.sprint_demands (sprint_id, demand_id)
    SELECT _carry_to, sd.demand_id FROM public.sprint_demands sd
    JOIN public.demands d ON d.id = sd.demand_id
    WHERE sd.sprint_id = _sprint_id AND d.delivered_at IS NULL AND d.archived = false
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS _moved = ROW_COUNT;
  END IF;
  RETURN _moved;
END $$;
REVOKE EXECUTE ON FUNCTION public.complete_sprint(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.complete_sprint(uuid, uuid) TO authenticated;