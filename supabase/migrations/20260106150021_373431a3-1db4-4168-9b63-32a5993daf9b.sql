-- Adicionar coluna comment_id para vincular anexos a comentários
ALTER TABLE public.demand_request_attachments 
ADD COLUMN comment_id UUID REFERENCES public.demand_request_comments(id) ON DELETE CASCADE;

-- Criar índice para melhorar performance de consultas por comentário
CREATE INDEX idx_demand_request_attachments_comment_id 
ON public.demand_request_attachments(comment_id);

-- Política para permitir que membros do time (admin, moderator, executor) façam upload de anexos em comentários
CREATE POLICY "Team members can upload comment attachments"
ON public.demand_request_attachments FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by AND
  (
    -- Anexo de comentário: verificar permissão via comentário
    (comment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.demand_request_comments c
      JOIN public.demand_requests dr ON dr.id = c.request_id
      JOIN public.team_members tm ON tm.team_id = dr.team_id
      WHERE c.id = comment_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('admin', 'moderator', 'executor')
    ))
    OR
    -- Anexo da solicitação (lógica existente - quando comment_id é NULL)
    (comment_id IS NULL AND demand_request_id IS NOT NULL)
  )
);