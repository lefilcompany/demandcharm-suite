-- =============================================
-- SISTEMA DE QUADROS (BOARDS)
-- =============================================

-- 1. Criar tabela de quadros
CREATE TABLE public.boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  monthly_demand_limit INTEGER DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca por equipe
CREATE INDEX idx_boards_team_id ON public.boards(team_id);

-- Constraint única para quadro padrão por equipe
CREATE UNIQUE INDEX idx_boards_default_per_team ON public.boards(team_id) WHERE is_default = true;

-- 2. Criar tabela de membros do quadro
CREATE TABLE public.board_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role team_role NOT NULL DEFAULT 'requester',
  added_by UUID,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(board_id, user_id)
);

CREATE INDEX idx_board_members_board_id ON public.board_members(board_id);
CREATE INDEX idx_board_members_user_id ON public.board_members(user_id);

-- 3. Adicionar board_id nas tabelas existentes
ALTER TABLE public.demands ADD COLUMN board_id UUID REFERENCES public.boards(id);
ALTER TABLE public.services ADD COLUMN board_id UUID REFERENCES public.boards(id);
ALTER TABLE public.demand_templates ADD COLUMN board_id UUID REFERENCES public.boards(id);
ALTER TABLE public.demand_requests ADD COLUMN board_id UUID REFERENCES public.boards(id);

-- Índices para as novas colunas
CREATE INDEX idx_demands_board_id ON public.demands(board_id);
CREATE INDEX idx_services_board_id ON public.services(board_id);
CREATE INDEX idx_demand_templates_board_id ON public.demand_templates(board_id);
CREATE INDEX idx_demand_requests_board_id ON public.demand_requests(board_id);

-- 4. Funções de segurança para quadros
CREATE OR REPLACE FUNCTION public.get_user_board_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT board_id
  FROM public.board_members
  WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_board_member(_user_id UUID, _board_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.board_members
    WHERE user_id = _user_id
      AND board_id = _board_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_board_role(_user_id UUID, _board_id UUID)
RETURNS team_role
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role
  FROM public.board_members
  WHERE user_id = _user_id
    AND board_id = _board_id
$$;

CREATE OR REPLACE FUNCTION public.is_board_admin_or_moderator(_user_id UUID, _board_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.board_members
    WHERE user_id = _user_id
      AND board_id = _board_id
      AND role IN ('admin', 'moderator')
  )
$$;

CREATE OR REPLACE FUNCTION public.has_board_role(_user_id UUID, _board_id UUID, _role team_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.board_members
    WHERE user_id = _user_id
      AND board_id = _board_id
      AND role = _role
  )
$$;

-- 5. Habilitar RLS
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS para boards
CREATE POLICY "Members can view their boards"
ON public.boards FOR SELECT
USING (id IN (SELECT get_user_board_ids(auth.uid())));

CREATE POLICY "Team admins/moderators can create boards"
ON public.boards FOR INSERT
WITH CHECK (is_team_admin_or_moderator(auth.uid(), team_id));

CREATE POLICY "Board admins/moderators can update boards"
ON public.boards FOR UPDATE
USING (is_board_admin_or_moderator(auth.uid(), id));

CREATE POLICY "Team admins can delete non-default boards"
ON public.boards FOR DELETE
USING (
  is_team_admin_or_moderator(auth.uid(), team_id) 
  AND is_default = false
);

-- 7. Políticas RLS para board_members
CREATE POLICY "Board members can view other members"
ON public.board_members FOR SELECT
USING (board_id IN (SELECT get_user_board_ids(auth.uid())));

CREATE POLICY "Board admins/moderators can add members"
ON public.board_members FOR INSERT
WITH CHECK (is_board_admin_or_moderator(auth.uid(), board_id));

CREATE POLICY "Board admins/moderators can update member roles"
ON public.board_members FOR UPDATE
USING (is_board_admin_or_moderator(auth.uid(), board_id));

CREATE POLICY "Board admins/moderators can remove members"
ON public.board_members FOR DELETE
USING (is_board_admin_or_moderator(auth.uid(), board_id));

-- 8. Trigger: Criar quadro padrão "EQUIPE" ao criar equipe
CREATE OR REPLACE FUNCTION public.create_default_board()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_board_id UUID;
BEGIN
  -- Criar quadro padrão "EQUIPE"
  INSERT INTO public.boards (team_id, name, is_default, created_by)
  VALUES (NEW.id, 'EQUIPE', true, NEW.created_by)
  RETURNING id INTO new_board_id;
  
  -- Adicionar criador como admin do quadro
  INSERT INTO public.board_members (board_id, user_id, role, added_by)
  VALUES (new_board_id, NEW.created_by, 'admin', NEW.created_by);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_team_created_create_board
  AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.create_default_board();

-- 9. Trigger: Adicionar membro ao quadro "EQUIPE" ao entrar na equipe
CREATE OR REPLACE FUNCTION public.add_member_to_default_board()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  default_board_id UUID;
BEGIN
  -- Encontrar o quadro padrão da equipe
  SELECT id INTO default_board_id 
  FROM public.boards 
  WHERE team_id = NEW.team_id AND is_default = true;
  
  -- Adicionar membro ao quadro EQUIPE como Solicitante
  IF default_board_id IS NOT NULL THEN
    INSERT INTO public.board_members (board_id, user_id, role, added_by)
    VALUES (default_board_id, NEW.user_id, 'requester', NEW.user_id)
    ON CONFLICT (board_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_team_member_added_add_to_board
  AFTER INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.add_member_to_default_board();

-- 10. Trigger updated_at para boards
CREATE TRIGGER update_boards_updated_at
  BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 11. Migração de dados existentes
-- Criar quadro EQUIPE para equipes existentes que não têm
INSERT INTO public.boards (team_id, name, is_default, created_by)
SELECT t.id, 'EQUIPE', true, t.created_by
FROM public.teams t
WHERE NOT EXISTS (
  SELECT 1 FROM public.boards b WHERE b.team_id = t.id AND b.is_default = true
);

-- Adicionar membros existentes ao quadro EQUIPE
INSERT INTO public.board_members (board_id, user_id, role, added_by)
SELECT b.id, tm.user_id, 
  CASE WHEN tm.role = 'admin' THEN 'admin'::team_role ELSE 'requester'::team_role END,
  tm.user_id
FROM public.team_members tm
JOIN public.boards b ON b.team_id = tm.team_id AND b.is_default = true
WHERE NOT EXISTS (
  SELECT 1 FROM public.board_members bm 
  WHERE bm.board_id = b.id AND bm.user_id = tm.user_id
);

-- Migrar demandas existentes para o quadro padrão
UPDATE public.demands d
SET board_id = (
  SELECT b.id FROM public.boards b 
  WHERE b.team_id = d.team_id AND b.is_default = true
)
WHERE d.board_id IS NULL;

-- Migrar serviços existentes para o quadro padrão
UPDATE public.services s
SET board_id = (
  SELECT b.id FROM public.boards b 
  WHERE b.team_id = s.team_id AND b.is_default = true
)
WHERE s.board_id IS NULL;

-- Migrar templates existentes para o quadro padrão
UPDATE public.demand_templates dt
SET board_id = (
  SELECT b.id FROM public.boards b 
  WHERE b.team_id = dt.team_id AND b.is_default = true
)
WHERE dt.board_id IS NULL;

-- Migrar solicitações existentes para o quadro padrão
UPDATE public.demand_requests dr
SET board_id = (
  SELECT b.id FROM public.boards b 
  WHERE b.team_id = dr.team_id AND b.is_default = true
)
WHERE dr.board_id IS NULL;