-- Create board_statuses table for configurable Kanban stages per board
CREATE TABLE public.board_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  status_id UUID NOT NULL REFERENCES public.demand_statuses(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(board_id, status_id)
);

-- Enable RLS
ALTER TABLE public.board_statuses ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if user is board admin or moderator
CREATE OR REPLACE FUNCTION public.is_board_admin_or_moderator(_user_id UUID, _board_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.board_members
    WHERE board_id = _board_id
      AND user_id = _user_id
      AND role IN ('admin', 'moderator')
  )
$$;

-- Create helper function to check if user is board member
CREATE OR REPLACE FUNCTION public.is_board_member(_user_id UUID, _board_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.board_members
    WHERE board_id = _board_id
      AND user_id = _user_id
  )
$$;

-- RLS Policies
CREATE POLICY "Board members can view board_statuses"
  ON public.board_statuses FOR SELECT
  USING (public.is_board_member(auth.uid(), board_id));

CREATE POLICY "Board admins can insert board_statuses"
  ON public.board_statuses FOR INSERT
  WITH CHECK (public.is_board_admin_or_moderator(auth.uid(), board_id));

CREATE POLICY "Board admins can update board_statuses"
  ON public.board_statuses FOR UPDATE
  USING (public.is_board_admin_or_moderator(auth.uid(), board_id));

CREATE POLICY "Board admins can delete board_statuses"
  ON public.board_statuses FOR DELETE
  USING (public.is_board_admin_or_moderator(auth.uid(), board_id));

-- Function to initialize default statuses when a board is created
CREATE OR REPLACE FUNCTION public.initialize_board_statuses()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.board_statuses (board_id, status_id, position)
  SELECT 
    NEW.id,
    ds.id,
    CASE ds.name
      WHEN 'A Iniciar' THEN 0
      WHEN 'Fazendo' THEN 1
      WHEN 'Em Ajuste' THEN 2
      WHEN 'Aprovação do Cliente' THEN 3
      WHEN 'Entregue' THEN 4
      ELSE 5
    END
  FROM public.demand_statuses ds
  WHERE ds.is_system = true
    AND ds.name != 'Atrasado';
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-initialize statuses for new boards
CREATE TRIGGER on_board_created_init_statuses
  AFTER INSERT ON public.boards
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_board_statuses();

-- Populate board_statuses for existing boards
INSERT INTO public.board_statuses (board_id, status_id, position)
SELECT 
  b.id,
  ds.id,
  CASE ds.name
    WHEN 'A Iniciar' THEN 0
    WHEN 'Fazendo' THEN 1
    WHEN 'Em Ajuste' THEN 2
    WHEN 'Aprovação do Cliente' THEN 3
    WHEN 'Entregue' THEN 4
    ELSE 5
  END
FROM public.boards b
CROSS JOIN public.demand_statuses ds
WHERE ds.is_system = true
  AND ds.name != 'Atrasado'
ON CONFLICT (board_id, status_id) DO NOTHING;

-- Enable realtime for board_statuses
ALTER PUBLICATION supabase_realtime ADD TABLE public.board_statuses;