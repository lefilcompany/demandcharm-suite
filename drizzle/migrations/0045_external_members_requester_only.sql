CREATE OR REPLACE FUNCTION public.enforce_external_board_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.boards b JOIN public.team_members tm ON tm.team_id = b.team_id
             WHERE b.id = NEW.board_id AND tm.user_id = NEW.user_id AND tm.member_kind = 'client_external') THEN
    IF TG_OP = 'UPDATE' AND NEW.role <> 'requester' THEN
      RAISE EXCEPTION 'Membros externos só podem ser Solicitantes no quadro' USING ERRCODE = 'P0001';
    END IF;
    NEW.role := 'requester';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_enforce_external_board_role ON public.board_members;
CREATE TRIGGER trg_enforce_external_board_role BEFORE INSERT OR UPDATE OF role ON public.board_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_external_board_role();

CREATE OR REPLACE FUNCTION public.sync_external_member_boards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.member_kind = 'client_external' AND (TG_OP = 'INSERT' OR OLD.member_kind IS DISTINCT FROM NEW.member_kind) THEN
    UPDATE public.board_members bm SET role = 'requester'
      FROM public.boards b WHERE b.id = bm.board_id AND b.team_id = NEW.team_id AND bm.user_id = NEW.user_id AND bm.role <> 'requester';
    INSERT INTO public.board_members (board_id, user_id, role, added_by)
      SELECT b.id, NEW.user_id, 'requester', auth.uid() FROM public.boards b
      WHERE b.team_id = NEW.team_id
        AND NOT EXISTS (SELECT 1 FROM public.board_members x WHERE x.board_id = b.id AND x.user_id = NEW.user_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_external_member_boards ON public.team_members;
CREATE TRIGGER trg_sync_external_member_boards AFTER INSERT OR UPDATE OF member_kind ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.sync_external_member_boards();

CREATE OR REPLACE FUNCTION public.add_external_members_to_new_board()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.board_members (board_id, user_id, role, added_by)
    SELECT NEW.id, tm.user_id, 'requester', NEW.created_by FROM public.team_members tm
    WHERE tm.team_id = NEW.team_id AND tm.member_kind = 'client_external'
      AND NOT EXISTS (SELECT 1 FROM public.board_members x WHERE x.board_id = NEW.id AND x.user_id = tm.user_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_add_external_members_to_new_board ON public.boards;
CREATE TRIGGER trg_add_external_members_to_new_board AFTER INSERT ON public.boards
FOR EACH ROW EXECUTE FUNCTION public.add_external_members_to_new_board();

REVOKE EXECUTE ON FUNCTION public.enforce_external_board_role(), public.sync_external_member_boards(), public.add_external_members_to_new_board() FROM anon, authenticated, public;