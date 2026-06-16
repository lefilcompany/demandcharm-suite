-- Criar tabela de comentários para solicitações de demanda
CREATE TABLE public.demand_request_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.demand_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.demand_request_comments ENABLE ROW LEVEL SECURITY;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.demand_request_comments;

-- Trigger para updated_at
CREATE TRIGGER update_demand_request_comments_updated_at
BEFORE UPDATE ON public.demand_request_comments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Políticas RLS para comentários

-- Admins, moderadores e executores podem ver comentários
CREATE POLICY "Team admins, moderators and executors can view request comments"
ON public.demand_request_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.demand_requests dr
    JOIN public.team_members tm ON tm.team_id = dr.team_id
    WHERE dr.id = request_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('admin', 'moderator', 'executor')
  )
);

-- Admins, moderadores e executores podem criar comentários
CREATE POLICY "Team admins, moderators and executors can create comments"
ON public.demand_request_comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.demand_requests dr
    JOIN public.team_members tm ON tm.team_id = dr.team_id
    WHERE dr.id = request_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('admin', 'moderator', 'executor')
  )
);

-- Usuários podem editar próprios comentários
CREATE POLICY "Users can update own request comments"
ON public.demand_request_comments FOR UPDATE
USING (auth.uid() = user_id);

-- Usuários podem deletar próprios comentários
CREATE POLICY "Users can delete own request comments"
ON public.demand_request_comments FOR DELETE
USING (auth.uid() = user_id);

-- Nova política para demand_requests: Executores podem ver solicitações
CREATE POLICY "Executors can view team requests"
ON public.demand_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = demand_requests.team_id
    AND tm.user_id = auth.uid()
    AND tm.role = 'executor'
  )
);

-- Função para notificar quando comentário é criado
CREATE OR REPLACE FUNCTION public.notify_request_comment_created()
RETURNS TRIGGER AS $$
DECLARE
  request_record RECORD;
  commenter_name TEXT;
  commenter_role public.team_role;
BEGIN
  SELECT * INTO request_record FROM public.demand_requests WHERE id = NEW.request_id;
  SELECT full_name INTO commenter_name FROM public.profiles WHERE id = NEW.user_id;
  SELECT role INTO commenter_role FROM public.team_members WHERE user_id = NEW.user_id AND team_id = request_record.team_id;
  
  -- Notifica admins/moderadores se comentário for de executor
  IF commenter_role = 'executor' THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT 
      tm.user_id,
      'Novo comentário em solicitação',
      COALESCE(commenter_name, 'Um usuário') || ' comentou na solicitação "' || request_record.title || '"',
      'info',
      '/demand-requests'
    FROM public.team_members tm
    WHERE tm.team_id = request_record.team_id
    AND tm.role IN ('admin', 'moderator')
    AND tm.user_id != NEW.user_id;
  END IF;
  
  -- Notifica o criador da solicitação
  IF request_record.created_by != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      request_record.created_by,
      'Novo comentário na sua solicitação',
      COALESCE(commenter_name, 'Um usuário') || ' comentou na sua solicitação "' || request_record.title || '"',
      'info',
      '/my-requests'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para notificação
CREATE TRIGGER on_request_comment_created
AFTER INSERT ON public.demand_request_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_request_comment_created();