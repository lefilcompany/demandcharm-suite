CREATE OR REPLACE FUNCTION public.sync_external_member_boards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.member_kind = 'client_external' AND (TG_OP = 'INSERT' OR OLD.member_kind IS DISTINCT FROM NEW.member_kind) THEN
    UPDATE public.board_members bm SET role = 'requester'
      FROM public.boards b WHERE b.id = bm.board_id AND b.team_id = NEW.team_id AND bm.user_id = NEW.user_id AND bm.role <> 'requester';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_add_external_members_to_new_board ON public.boards;
COMMENT ON FUNCTION public.add_external_members_to_new_board() IS 'DEPRECATED: externals are no longer auto-added to new boards';