
CREATE TABLE public.demand_request_submit_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  team_id UUID,
  board_id UUID,
  form_id TEXT NOT NULL,
  failed_validations TEXT[] NOT NULL DEFAULT '{}',
  draft_snapshot JSONB,
  user_agent TEXT,
  path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_drsb_user ON public.demand_request_submit_blocks(user_id, created_at DESC);
CREATE INDEX idx_drsb_board ON public.demand_request_submit_blocks(board_id, created_at DESC);

GRANT SELECT, INSERT ON public.demand_request_submit_blocks TO authenticated;
GRANT ALL ON public.demand_request_submit_blocks TO service_role;

ALTER TABLE public.demand_request_submit_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own blocked submits"
  ON public.demand_request_submit_blocks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read their own blocked submits"
  ON public.demand_request_submit_blocks
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all blocked submits"
  ON public.demand_request_submit_blocks
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
