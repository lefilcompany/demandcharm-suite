CREATE TABLE public.user_board_ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  insights jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, board_id)
);

GRANT SELECT ON public.user_board_ai_insights TO authenticated;
GRANT ALL ON public.user_board_ai_insights TO service_role;

ALTER TABLE public.user_board_ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own board insights"
  ON public.user_board_ai_insights
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_user_board_ai_insights_expires ON public.user_board_ai_insights (expires_at);

CREATE OR REPLACE FUNCTION public.update_user_board_ai_insights_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_board_ai_insights_updated_at
BEFORE UPDATE ON public.user_board_ai_insights
FOR EACH ROW EXECUTE FUNCTION public.update_user_board_ai_insights_updated_at();