-- Remove duplicate triggers that cause conflicts
DROP TRIGGER IF EXISTS on_team_created_create_board ON teams;
DROP TRIGGER IF EXISTS on_team_member_added_add_to_board ON team_members;

-- Update create_default_board function to use ON CONFLICT DO NOTHING
CREATE OR REPLACE FUNCTION public.create_default_board()
RETURNS TRIGGER AS $$
DECLARE
  new_board_id UUID;
BEGIN
  -- Create default "EQUIPE" board
  INSERT INTO public.boards (team_id, name, is_default, created_by)
  VALUES (NEW.id, 'EQUIPE', true, NEW.created_by)
  RETURNING id INTO new_board_id;
  
  -- Add creator as board admin (with protection against duplicate)
  INSERT INTO public.board_members (board_id, user_id, role, added_by)
  VALUES (new_board_id, NEW.created_by, 'admin', NEW.created_by)
  ON CONFLICT (board_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;