-- Create trigger to add board creator as admin member
CREATE OR REPLACE FUNCTION public.add_creator_to_board()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add the creator as admin of the new board
  INSERT INTO public.board_members (board_id, user_id, role, added_by)
  VALUES (NEW.id, NEW.created_by, 'admin', NEW.created_by)
  ON CONFLICT (board_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_board_created ON public.boards;
CREATE TRIGGER on_board_created
  AFTER INSERT ON public.boards
  FOR EACH ROW
  EXECUTE FUNCTION public.add_creator_to_board();