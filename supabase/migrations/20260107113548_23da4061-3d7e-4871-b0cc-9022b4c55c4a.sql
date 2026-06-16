-- Create board_services table to link boards with services and their limits
CREATE TABLE public.board_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  monthly_limit INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(board_id, service_id)
);

-- Indexes for performance
CREATE INDEX idx_board_services_board_id ON public.board_services(board_id);
CREATE INDEX idx_board_services_service_id ON public.board_services(service_id);

-- Enable RLS
ALTER TABLE public.board_services ENABLE ROW LEVEL SECURITY;

-- Board members can view board_services
CREATE POLICY "Board members can view board_services"
  ON public.board_services FOR SELECT
  USING (public.is_board_member(auth.uid(), board_id));

-- Board admins/moderators can insert
CREATE POLICY "Board admins can insert board_services"
  ON public.board_services FOR INSERT
  WITH CHECK (public.is_board_admin_or_moderator(auth.uid(), board_id));

-- Board admins/moderators can update
CREATE POLICY "Board admins can update board_services"
  ON public.board_services FOR UPDATE
  USING (public.is_board_admin_or_moderator(auth.uid(), board_id));

-- Board admins/moderators can delete
CREATE POLICY "Board admins can delete board_services"
  ON public.board_services FOR DELETE
  USING (public.is_board_admin_or_moderator(auth.uid(), board_id));

-- Function to count demands by service in a board for current month
CREATE OR REPLACE FUNCTION public.get_board_service_demand_count(
  _board_id UUID,
  _service_id UUID
) RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.demands
  WHERE board_id = _board_id
    AND service_id = _service_id
    AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
    AND archived = false
$$;

-- Function to check if can create demand with specific service
CREATE OR REPLACE FUNCTION public.can_create_demand_with_service(
  _board_id UUID,
  _service_id UUID
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE 
    -- If no board_service config exists, check if board has ANY services configured
    -- If board has no services configured at all, allow creation (legacy behavior)
    WHEN NOT EXISTS (SELECT 1 FROM public.board_services WHERE board_id = _board_id) THEN true
    -- If board has services but this service is not configured, block
    WHEN NOT EXISTS (
      SELECT 1 FROM public.board_services 
      WHERE board_id = _board_id AND service_id = _service_id
    ) THEN false
    -- If limit = 0, it's unlimited
    WHEN (SELECT monthly_limit FROM public.board_services WHERE board_id = _board_id AND service_id = _service_id) = 0 THEN true
    -- Check if within limit
    ELSE (
      SELECT COUNT(*) < (SELECT monthly_limit FROM public.board_services WHERE board_id = _board_id AND service_id = _service_id)
      FROM public.demands
      WHERE board_id = _board_id
        AND service_id = _service_id
        AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
        AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
        AND archived = false
    )
  END
$$;