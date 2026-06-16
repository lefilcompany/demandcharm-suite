-- Tabela de configurações padrão de notificação de aprovação por quadro
CREATE TABLE IF NOT EXISTS public.board_approval_notify_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  approval_type text NOT NULL CHECK (approval_type IN ('internal','external')),
  recipient_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  include_creator boolean NOT NULL DEFAULT true,
  mode text NOT NULL DEFAULT 'manual' CHECK (mode IN ('all','manual')),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, approval_type)
);

ALTER TABLE public.board_approval_notify_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board members can view approval notify settings"
  ON public.board_approval_notify_settings FOR SELECT
  USING (is_board_member(auth.uid(), board_id));

CREATE POLICY "Board admins/moderators can insert approval notify settings"
  ON public.board_approval_notify_settings FOR INSERT
  WITH CHECK (is_board_admin_or_moderator(auth.uid(), board_id));

CREATE POLICY "Board admins/moderators can update approval notify settings"
  ON public.board_approval_notify_settings FOR UPDATE
  USING (is_board_admin_or_moderator(auth.uid(), board_id))
  WITH CHECK (is_board_admin_or_moderator(auth.uid(), board_id));

CREATE POLICY "Board admins/moderators can delete approval notify settings"
  ON public.board_approval_notify_settings FOR DELETE
  USING (is_board_admin_or_moderator(auth.uid(), board_id));

CREATE TRIGGER update_board_approval_notify_settings_updated_at
  BEFORE UPDATE ON public.board_approval_notify_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_board_approval_notify_settings_board
  ON public.board_approval_notify_settings(board_id);
