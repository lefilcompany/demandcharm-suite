-- Tabela de planos disponíveis
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  max_teams INTEGER DEFAULT 1,
  max_boards INTEGER DEFAULT 1,
  max_members INTEGER DEFAULT 3,
  max_demands_per_month INTEGER DEFAULT 30,
  max_services INTEGER DEFAULT 5,
  max_notes INTEGER DEFAULT 0,
  features JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de assinaturas das equipes
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  cancel_at_period_end BOOLEAN DEFAULT false,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id)
);

-- Tabela de registros de uso mensal
CREATE TABLE public.usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  demands_created INTEGER DEFAULT 0,
  members_count INTEGER DEFAULT 0,
  boards_count INTEGER DEFAULT 0,
  notes_count INTEGER DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, period_start)
);

-- Habilitar RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para plans (leitura pública para autenticados)
CREATE POLICY "Authenticated users can view plans"
ON public.plans FOR SELECT
TO authenticated
USING (is_active = true);

-- Políticas RLS para subscriptions
CREATE POLICY "Team members can view their subscription"
ON public.subscriptions FOR SELECT
USING (is_team_member(auth.uid(), team_id));

CREATE POLICY "Team admins can insert subscription"
ON public.subscriptions FOR INSERT
WITH CHECK (is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can update subscription"
ON public.subscriptions FOR UPDATE
USING (is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can delete subscription"
ON public.subscriptions FOR DELETE
USING (is_team_admin(auth.uid(), team_id));

-- Políticas RLS para usage_records
CREATE POLICY "Team members can view their usage"
ON public.usage_records FOR SELECT
USING (is_team_member(auth.uid(), team_id));

CREATE POLICY "System can insert usage records"
ON public.usage_records FOR INSERT
WITH CHECK (is_team_member(auth.uid(), team_id));

CREATE POLICY "System can update usage records"
ON public.usage_records FOR UPDATE
USING (is_team_member(auth.uid(), team_id));

-- Inserir planos iniciais
INSERT INTO public.plans (name, slug, description, price_cents, max_boards, max_members, max_demands_per_month, max_services, max_notes, features, sort_order) VALUES
('Starter', 'starter', 'Ideal para freelancers e pequenos projetos', 5900, 1, 3, 30, 5, 0, '{"time_tracking": "basic", "notifications": "in_app", "support": "docs"}', 1),
('Profissional', 'profissional', 'Para agências pequenas e equipes de marketing', 9700, 5, 10, 200, 20, 10, '{"time_tracking": "full", "notifications": "push_email", "reports": "pdf_csv", "support": "email", "share_external": true}', 2),
('Business', 'business', 'Para agências médias e escritórios', 24700, 15, 30, 500, -1, -1, '{"time_tracking": "full", "notifications": "push_email", "reports": "advanced", "ai_summary": true, "contracts": true, "support": "priority"}', 3),
('Enterprise', 'enterprise', 'Solução personalizada para grandes empresas', 49700, -1, -1, -1, -1, -1, '{"time_tracking": "full", "notifications": "all", "reports": "whitelabel", "ai_summary": true, "contracts": true, "api": true, "support": "dedicated", "sla": true}', 4);

-- Função para atualizar usage_records quando demanda é criada
CREATE OR REPLACE FUNCTION public.update_usage_on_demand_create()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usage_records (team_id, period_start, period_end, demands_created)
  VALUES (
    NEW.team_id, 
    date_trunc('month', now()), 
    date_trunc('month', now()) + interval '1 month', 
    1
  )
  ON CONFLICT (team_id, period_start)
  DO UPDATE SET 
    demands_created = public.usage_records.demands_created + 1, 
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para atualizar uso ao criar demanda
CREATE TRIGGER on_demand_create_update_usage
AFTER INSERT ON public.demands
FOR EACH ROW
EXECUTE FUNCTION public.update_usage_on_demand_create();

-- Função para verificar limite de assinatura
CREATE OR REPLACE FUNCTION public.check_subscription_limit(
  _team_id UUID,
  _resource_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  _plan_limit INTEGER;
  _current_usage INTEGER;
  _plan_record RECORD;
BEGIN
  -- Busca o plano da equipe
  SELECT p.* INTO _plan_record
  FROM public.subscriptions s
  JOIN public.plans p ON s.plan_id = p.id
  WHERE s.team_id = _team_id AND s.status = 'active';
  
  -- Se não tem assinatura, usa limites do Starter
  IF _plan_record IS NULL THEN
    SELECT * INTO _plan_record FROM public.plans WHERE slug = 'starter';
  END IF;
  
  -- Verifica o tipo de recurso
  CASE _resource_type
    WHEN 'demands' THEN
      _plan_limit := _plan_record.max_demands_per_month;
      SELECT COALESCE(demands_created, 0) INTO _current_usage
      FROM public.usage_records
      WHERE team_id = _team_id AND period_start = date_trunc('month', now());
    WHEN 'boards' THEN
      _plan_limit := _plan_record.max_boards;
      SELECT COUNT(*) INTO _current_usage FROM public.boards WHERE team_id = _team_id;
    WHEN 'members' THEN
      _plan_limit := _plan_record.max_members;
      SELECT COUNT(*) INTO _current_usage FROM public.team_members WHERE team_id = _team_id;
    ELSE
      RETURN true;
  END CASE;
  
  -- -1 significa ilimitado
  IF _plan_limit = -1 THEN
    RETURN true;
  END IF;
  
  RETURN COALESCE(_current_usage, 0) < _plan_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função auxiliar para obter plano atual da equipe
CREATE OR REPLACE FUNCTION public.get_team_plan(_team_id UUID)
RETURNS public.plans AS $$
DECLARE
  _plan public.plans;
BEGIN
  SELECT p.* INTO _plan
  FROM public.subscriptions s
  JOIN public.plans p ON s.plan_id = p.id
  WHERE s.team_id = _team_id AND s.status = 'active';
  
  IF _plan IS NULL THEN
    SELECT * INTO _plan FROM public.plans WHERE slug = 'starter';
  END IF;
  
  RETURN _plan;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para atualizar updated_at em subscriptions
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();