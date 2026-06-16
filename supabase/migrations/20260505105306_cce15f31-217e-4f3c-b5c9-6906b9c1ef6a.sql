
CREATE TABLE IF NOT EXISTS public.demand_approval_notify_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  approval_type text NOT NULL CHECK (approval_type IN ('internal','external')),
  mode text NOT NULL DEFAULT 'all' CHECK (mode IN ('all','manual')),
  recipient_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  include_creator boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (demand_id, approval_type)
);

CREATE INDEX IF NOT EXISTS idx_demand_approval_notify_settings_demand
  ON public.demand_approval_notify_settings(demand_id);

ALTER TABLE public.demand_approval_notify_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board members can view demand approval settings"
ON public.demand_approval_notify_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.demands d
    WHERE d.id = demand_id
      AND public.is_board_member(auth.uid(), d.board_id)
  )
);

CREATE POLICY "Board members can insert demand approval settings"
ON public.demand_approval_notify_settings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.demands d
    WHERE d.id = demand_id
      AND public.is_board_member(auth.uid(), d.board_id)
  )
);

CREATE POLICY "Board members can update demand approval settings"
ON public.demand_approval_notify_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.demands d
    WHERE d.id = demand_id
      AND public.is_board_member(auth.uid(), d.board_id)
  )
);

CREATE POLICY "Board members can delete demand approval settings"
ON public.demand_approval_notify_settings
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.demands d
    WHERE d.id = demand_id
      AND public.is_board_member(auth.uid(), d.board_id)
  )
);

CREATE TRIGGER demand_approval_notify_settings_updated_at
BEFORE UPDATE ON public.demand_approval_notify_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
