-- Create table to store AI analysis history
CREATE TABLE public.board_summary_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  analytics_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for share tokens
CREATE TABLE public.board_summary_share_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  summary_id UUID NOT NULL REFERENCES public.board_summary_history(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.board_summary_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_summary_share_tokens ENABLE ROW LEVEL SECURITY;

-- Policies for board_summary_history
CREATE POLICY "Board members can view summaries"
ON public.board_summary_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.board_members bm
    WHERE bm.board_id = board_summary_history.board_id
    AND bm.user_id = auth.uid()
  )
);

CREATE POLICY "Board members can create summaries"
ON public.board_summary_history
FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND
  EXISTS (
    SELECT 1 FROM public.board_members bm
    WHERE bm.board_id = board_summary_history.board_id
    AND bm.user_id = auth.uid()
  )
);

CREATE POLICY "Summary creator can delete"
ON public.board_summary_history
FOR DELETE
USING (auth.uid() = created_by);

-- Policies for share tokens
CREATE POLICY "Token creators can manage tokens"
ON public.board_summary_share_tokens
FOR ALL
USING (auth.uid() = created_by);

CREATE POLICY "Board members can view tokens"
ON public.board_summary_share_tokens
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.board_summary_history bsh
    JOIN public.board_members bm ON bm.board_id = bsh.board_id
    WHERE bsh.id = board_summary_share_tokens.summary_id
    AND bm.user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_board_summary_history_board_id ON public.board_summary_history(board_id);
CREATE INDEX idx_board_summary_share_tokens_token ON public.board_summary_share_tokens(token);
CREATE INDEX idx_board_summary_share_tokens_summary_id ON public.board_summary_share_tokens(summary_id);