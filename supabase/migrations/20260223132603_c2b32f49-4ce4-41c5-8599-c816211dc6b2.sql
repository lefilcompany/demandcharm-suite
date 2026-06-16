
-- Create recurring_demands table
CREATE TABLE public.recurring_demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  
  -- Demand template
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'média',
  status_id UUID NOT NULL REFERENCES public.demand_statuses(id),
  service_id UUID REFERENCES public.services(id),
  assignee_ids UUID[] DEFAULT '{}',
  
  -- Recurrence config
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  weekdays INTEGER[] DEFAULT '{}',
  day_of_month INTEGER,
  start_date DATE NOT NULL,
  end_date DATE,
  
  -- Control
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_generated_at TIMESTAMPTZ,
  next_run_date DATE NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recurring_demands ENABLE ROW LEVEL SECURITY;

-- RLS Policies: board members can manage their recurring demands
CREATE POLICY "Board members can view recurring demands"
ON public.recurring_demands FOR SELECT
USING (board_id IN (SELECT get_user_board_ids(auth.uid())));

CREATE POLICY "Board members can create recurring demands"
ON public.recurring_demands FOR INSERT
WITH CHECK (board_id IN (SELECT get_user_board_ids(auth.uid())) AND auth.uid() = created_by);

CREATE POLICY "Board admins can update recurring demands"
ON public.recurring_demands FOR UPDATE
USING (is_board_admin_or_moderator(auth.uid(), board_id));

CREATE POLICY "Creator can update own recurring demands"
ON public.recurring_demands FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Board admins can delete recurring demands"
ON public.recurring_demands FOR DELETE
USING (is_board_admin_or_moderator(auth.uid(), board_id));

CREATE POLICY "Creator can delete own recurring demands"
ON public.recurring_demands FOR DELETE
USING (auth.uid() = created_by);

-- Updated_at trigger
CREATE TRIGGER update_recurring_demands_updated_at
BEFORE UPDATE ON public.recurring_demands
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
