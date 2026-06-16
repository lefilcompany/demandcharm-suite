
-- Add "Tarefas Internas" status to all existing boards that don't have it yet
DO $$
DECLARE
  v_board RECORD;
  v_new_status_id UUID;
  v_fazendo_position INTEGER;
BEGIN
  FOR v_board IN SELECT id FROM public.boards LOOP
    -- Skip if board already has "Tarefas Internas"
    IF EXISTS (
      SELECT 1 FROM public.board_statuses bs
      JOIN public.demand_statuses ds ON ds.id = bs.status_id
      WHERE bs.board_id = v_board.id AND ds.name = 'Tarefas Internas'
    ) THEN
      CONTINUE;
    END IF;

    -- Find the position of "Fazendo" or "Em Andamento" to insert before it
    SELECT bs.position INTO v_fazendo_position
    FROM public.board_statuses bs
    JOIN public.demand_statuses ds ON ds.id = bs.status_id
    WHERE bs.board_id = v_board.id AND ds.name IN ('Fazendo', 'Em Andamento')
    ORDER BY bs.position
    LIMIT 1;

    -- If no "Fazendo" found, use position 1 (after first status)
    IF v_fazendo_position IS NULL THEN
      v_fazendo_position := 1;
    END IF;

    -- Shift all statuses at or after that position by 1
    UPDATE public.board_statuses
    SET position = position + 1
    WHERE board_id = v_board.id AND position >= v_fazendo_position;

    -- Create the "Tarefas Internas" status for this board
    INSERT INTO public.demand_statuses (name, color, board_id, is_system)
    VALUES ('Tarefas Internas', '#8B5CF6', v_board.id, true)
    RETURNING id INTO v_new_status_id;

    -- Add it to board_statuses at the correct position
    INSERT INTO public.board_statuses (board_id, status_id, position, is_active)
    VALUES (v_board.id, v_new_status_id, v_fazendo_position, true);
  END LOOP;
END;
$$;
