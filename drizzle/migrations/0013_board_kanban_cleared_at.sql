ALTER TABLE public.boards ADD COLUMN kanban_cleared_at timestamptz;
COMMENT ON COLUMN public.boards.kanban_cleared_at IS 'Demandas entregues antes desta data ficam ocultas no Kanban (continuam na lista)';

CREATE OR REPLACE FUNCTION public.clear_board_kanban(_board_id uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _now timestamptz := now();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.board_members WHERE board_id = _board_id AND user_id = (select auth.uid()) AND role IN ('admin','moderator')) THEN
    RAISE EXCEPTION 'Apenas administradores e coordenadores do quadro podem limpar o Kanban';
  END IF;
  UPDATE public.boards SET kanban_cleared_at = _now WHERE id = _board_id;
  RETURN _now;
END $$;
REVOKE EXECUTE ON FUNCTION public.clear_board_kanban(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.clear_board_kanban(uuid) TO authenticated;