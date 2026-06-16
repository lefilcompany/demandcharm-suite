-- Add board_sequence_number column to demands table
ALTER TABLE public.demands 
ADD COLUMN board_sequence_number INTEGER;

-- Create unique index to ensure unique sequence per board
CREATE UNIQUE INDEX idx_demands_board_sequence 
ON public.demands(board_id, board_sequence_number);

-- Migrate existing data: assign sequential numbers based on created_at order per board
WITH numbered_demands AS (
  SELECT id, board_id, 
    ROW_NUMBER() OVER (PARTITION BY board_id ORDER BY created_at) as seq_num
  FROM public.demands
)
UPDATE public.demands d
SET board_sequence_number = nd.seq_num
FROM numbered_demands nd
WHERE d.id = nd.id;

-- Create function to auto-set sequence number on new demands
CREATE OR REPLACE FUNCTION public.set_demand_sequence_number()
RETURNS TRIGGER AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(board_sequence_number), 0) + 1
  INTO next_seq
  FROM public.demands
  WHERE board_id = NEW.board_id;
  
  NEW.board_sequence_number := next_seq;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-assign sequence number
CREATE TRIGGER trigger_set_demand_sequence
BEFORE INSERT ON public.demands
FOR EACH ROW
WHEN (NEW.board_sequence_number IS NULL)
EXECUTE FUNCTION public.set_demand_sequence_number();