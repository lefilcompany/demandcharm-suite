
CREATE OR REPLACE FUNCTION public.reassign_demand_sequence_on_board_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  IF NEW.board_id IS DISTINCT FROM OLD.board_id THEN
    SELECT COALESCE(MAX(board_sequence_number), 0) + 1
      INTO next_seq
      FROM public.demands
     WHERE board_id = NEW.board_id
       AND id <> NEW.id;
    NEW.board_sequence_number := next_seq;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_reassign_demand_sequence ON public.demands;
CREATE TRIGGER trigger_reassign_demand_sequence
BEFORE UPDATE OF board_id ON public.demands
FOR EACH ROW
EXECUTE FUNCTION public.reassign_demand_sequence_on_board_change();
