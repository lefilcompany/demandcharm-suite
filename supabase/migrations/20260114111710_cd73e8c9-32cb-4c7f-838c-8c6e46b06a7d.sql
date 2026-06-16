-- Adicionar coluna parent_id para referência ao serviço pai (hierarquia)
ALTER TABLE public.services ADD COLUMN parent_id UUID REFERENCES public.services(id) ON DELETE SET NULL;

-- Criar índice para melhor performance nas queries hierárquicas
CREATE INDEX idx_services_parent_id ON public.services(parent_id);