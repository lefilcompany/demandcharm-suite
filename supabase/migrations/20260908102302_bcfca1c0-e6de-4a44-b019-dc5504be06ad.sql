-- 1. Columns on services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS is_catalog boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hours_min numeric,
  ADD COLUMN IF NOT EXISTS hours_max numeric,
  ADD COLUMN IF NOT EXISTS hours_unit text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS catalog_key text;

CREATE UNIQUE INDEX IF NOT EXISTS services_team_catalog_key_uidx
  ON public.services (team_id, catalog_key) WHERE catalog_key IS NOT NULL;

-- 2. Reference catalog table
CREATE TABLE IF NOT EXISTS public.service_catalog_items (
  catalog_key text PRIMARY KEY,
  area_key text NOT NULL,
  area_name text NOT NULL,
  area_order integer NOT NULL,
  name text NOT NULL,
  description text,
  hours_min numeric,
  hours_max numeric,
  hours_unit text NOT NULL DEFAULT 'entrega',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.service_catalog_items TO authenticated;
GRANT SELECT ON public.service_catalog_items TO anon;
GRANT ALL ON public.service_catalog_items TO service_role;
ALTER TABLE public.service_catalog_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view service catalog" ON public.service_catalog_items;
CREATE POLICY "Anyone can view service catalog" ON public.service_catalog_items FOR SELECT USING (true);

INSERT INTO public.service_catalog_items (catalog_key, area_key, area_name, area_order, name, description, hours_min, hours_max, hours_unit, sort_order) VALUES
('conteudo/planejamento-conteudo','conteudo','Conteúdo e Criação',1,'Planejamento de conteúdo','Planejamento editorial, pautas, formatos e calendário do período.',4,8,'entrega',1),
('conteudo/post-feed','conteudo','Conteúdo e Criação',1,'Post Feed','Criação de peça estática + copy/legenda.',1,2,'entrega',2),
('conteudo/post-carrossel','conteudo','Conteúdo e Criação',1,'Post Carrossel','Roteiro, copy e design de carrossel.',2,4,'entrega',3),
('conteudo/post-story','conteudo','Conteúdo e Criação',1,'Post Story','Criação de story individual ou sequência curta.',0.5,1,'entrega',4),
('conteudo/post-feed-story','conteudo','Conteúdo e Criação',1,'Post Feed + Story','Peça de feed com adaptação para story.',1.5,2.5,'entrega',5),
('conteudo/reels','conteudo','Conteúdo e Criação',1,'Reels','Roteiro, edição/design, copy e finalização de reels sem captação complexa.',2,4,'entrega',6),
('conteudo/video-captacao','conteudo','Conteúdo e Criação',1,'Vídeo com captação','Roteiro, preparação, captação, edição e finalização.',6,12,'entrega',7),
('conteudo/animacao-motion','conteudo','Conteúdo e Criação',1,'Animação / Motion','Animação gráfica ou motion para peça/vídeo.',2,6,'entrega',8),
('conteudo/copy-redacao','conteudo','Conteúdo e Criação',1,'Copy / Redação','Legenda, texto de campanha, roteiro curto ou texto para peça.',0.5,2,'entrega',9),
('conteudo/newsletter','conteudo','Conteúdo e Criação',1,'Newsletter','Pauta, redação, diagramação, revisão e preparação para disparo.',3,6,'entrega',10),
('conteudo/landing-page','conteudo','Conteúdo e Criação',1,'Landing Page','Estrutura, copy, design e montagem de landing page simples.',6,12,'entrega',11),
('conteudo/peca-anuncio','conteudo','Conteúdo e Criação',1,'Peça de anúncio','Criativo específico para mídia paga.',1,2,'entrega',12),
('conteudo/desdobramento','conteudo','Conteúdo e Criação',1,'Desdobramento / Redimensionamento','Adaptação de peça aprovada para outros formatos.',0.25,1,'entrega',13),
('conteudo/identidade-visual-kv','conteudo','Conteúdo e Criação',1,'Identidade visual / KV','Conceito visual, direção e peças-mãe de campanha.',8,16,'entrega',14),
('conteudo/diagramacao','conteudo','Conteúdo e Criação',1,'Diagramação','Diagramação de apresentação, relatório, e-book ou material editorial.',4,12,'entrega',15),
('conteudo/material-impresso','conteudo','Conteúdo e Criação',1,'Material impresso','Criação/adaptação de folder, cartaz, convite, sinalização ou similar.',2,6,'entrega',16),
('conteudo/icones-elementos','conteudo','Conteúdo e Criação',1,'Ícones / Elementos gráficos','Criação de conjunto de ícones ou elementos de apoio.',1,4,'entrega',17),
('conteudo/locucao','conteudo','Conteúdo e Criação',1,'Locução','Preparação de texto, acompanhamento e tratamento simples de locução.',1,3,'entrega',18),
('conteudo/pesquisa-referencias','conteudo','Conteúdo e Criação',1,'Pesquisa / Referências','Pesquisa de referências, tendências, concorrência e repertório criativo.',1,3,'entrega',19),
('conteudo/revisao-ajustes','conteudo','Conteúdo e Criação',1,'Revisão / Ajustes de conteúdo','Rodada de revisão e alterações após retorno.',0.5,2,'entrega',20),
('conteudo/publicacao-agendamento','conteudo','Conteúdo e Criação',1,'Publicação / Agendamento','Configuração e publicação/agendamento nos canais.',0.25,0.5,'entrega',21),

('midia/planejamento-midia','midia','Mídia, Performance e Retail Media',2,'Planejamento de mídia','Objetivos, públicos, canais, verba, distribuição e KPIs.',4,8,'entrega',1),
('midia/configuracao-campanha','midia','Mídia, Performance e Retail Media',2,'Configuração de campanha','Criação/configuração de campanha, conjuntos, públicos e anúncios.',2,4,'entrega',2),
('midia/meta-ads','midia','Mídia, Performance e Retail Media',2,'Meta Ads','Operação específica de campanha em Meta.',1,3,'entrega',3),
('midia/google-ads','midia','Mídia, Performance e Retail Media',2,'Google Ads','Operação de Search, Display ou YouTube.',2,4,'entrega',4),
('midia/retail-media','midia','Mídia, Performance e Retail Media',2,'Retail Media / Marketplace','Configuração e gestão de campanhas em marketplaces/retail media.',2,4,'entrega',5),
('midia/criativo-performance','midia','Mídia, Performance e Retail Media',2,'Criativo de performance','Criação/adaptação de criativo orientado a conversão.',1,2,'entrega',6),
('midia/teste-ab','midia','Mídia, Performance e Retail Media',2,'Teste A/B','Planejamento, configuração e leitura de experimento.',1,2,'entrega',7),
('midia/otimizacao-campanha','midia','Mídia, Performance e Retail Media',2,'Otimização de campanha','Análise e ajustes de verba, público, criativos e lances.',0.5,1.5,'entrega',8),
('midia/monitoramento-campanha','midia','Mídia, Performance e Retail Media',2,'Monitoramento de campanha','Acompanhamento de performance e identificação de desvios.',0.5,1,'entrega',9),
('midia/config-conversao','midia','Mídia, Performance e Retail Media',2,'Configuração de conversão / Pixel / Tag','Configuração ou validação de mensuração.',2,6,'entrega',10),

('monitoramento/ronda','monitoramento','Monitoramento e Inteligência',3,'Ronda de monitoramento','Leitura e triagem periódica das menções relevantes.',0.5,1,'entrega',1),
('monitoramento/gestao-crise','monitoramento','Monitoramento e Inteligência',3,'Gestão de crise','Acompanhamento intensivo, análise e recomendação durante situação crítica.',2,8,'entrega',2),
('monitoramento/configuracao','monitoramento','Monitoramento e Inteligência',3,'Configuração de monitoramento','Definição de temas, termos, fontes, regras e filtros.',2,4,'entrega',3),
('monitoramento/analise-mencoes','monitoramento','Monitoramento e Inteligência',3,'Análise de menções / sentimento','Classificação e interpretação das conversas coletadas.',1,3,'entrega',4),
('monitoramento/analise-tendencias','monitoramento','Monitoramento e Inteligência',3,'Análise de tendências / temas','Identificação de padrões, assuntos emergentes e oportunidades.',2,4,'entrega',5),
('monitoramento/alerta-reputacao','monitoramento','Monitoramento e Inteligência',3,'Alerta de reputação','Validação do alerta, contexto e recomendação inicial.',0.5,1,'entrega',6),
('monitoramento/relatorio','monitoramento','Monitoramento e Inteligência',3,'Relatório de monitoramento','Síntese de dados, análise e recomendações.',3,6,'entrega',7),
('monitoramento/relatorio-crise','monitoramento','Monitoramento e Inteligência',3,'Relatório de crise','Linha do tempo, repercussão, análise e orientação estratégica.',4,8,'entrega',8),

('comunidades/planejamento','comunidades','Comunidades',4,'Planejamento da comunidade','Objetivos, públicos, proposta de valor, rituais e plano de ativação.',6,12,'entrega',1),
('comunidades/gestao','comunidades','Comunidades',4,'Gestão da comunidade','Coordenação recorrente da operação, prioridades e acompanhamento.',2,4,'semana',2),
('comunidades/moderacao','comunidades','Comunidades',4,'Moderação','Leitura, aprovação, intervenção e aplicação de regras.',0.5,2,'dia',3),
('comunidades/interacao-membros','comunidades','Comunidades',4,'Interação com membros','Respostas, estímulo a conversas e relacionamento.',0.5,2,'dia',4),
('comunidades/onboarding-membros','comunidades','Comunidades',4,'Onboarding de membros','Fluxos, conteúdos e ações de entrada/ativação.',2,4,'entrega',5),
('comunidades/acao-engajamento','comunidades','Comunidades',4,'Ação de engajamento','Planejamento e execução de desafio, campanha ou ritual.',3,6,'entrega',6),
('comunidades/conteudo','comunidades','Comunidades',4,'Conteúdo para comunidade','Post, tópico ou conteúdo específico para a comunidade.',1,2,'entrega',7),
('comunidades/live-encontro','comunidades','Comunidades',4,'Live / Encontro','Planejamento, organização, acompanhamento e pós-encontro.',4,8,'entrega',8),
('comunidades/gamificacao','comunidades','Comunidades',4,'Gamificação / Badges','Desenho de mecânica, critérios e configuração.',3,6,'entrega',9),
('comunidades/embaixadores','comunidades','Comunidades',4,'Gestão de embaixadores','Seleção, relacionamento, briefing e acompanhamento.',2,4,'semana',10),
('comunidades/pesquisa-membros','comunidades','Comunidades',4,'Pesquisa / Enquete com membros','Desenho, aplicação e análise.',2,4,'entrega',11),
('comunidades/curadoria','comunidades','Comunidades',4,'Curadoria de conteúdo','Seleção e organização de conteúdos relevantes.',1,3,'entrega',12),
('comunidades/relatorio','comunidades','Comunidades',4,'Relatório de comunidade','Engajamento, crescimento, comportamento e recomendações.',3,6,'entrega',13),
('comunidades/analise-lekpis','comunidades','Comunidades',4,'Análise LeKPIs','Leitura de indicadores e definição de ações de melhoria.',2,4,'entrega',14),
('comunidades/jornada-membro','comunidades','Comunidades',4,'Jornada do membro / UX','Mapeamento da experiência, fricções e oportunidades.',6,12,'entrega',15),
('comunidades/arquitetura','comunidades','Comunidades',4,'Arquitetura da comunidade','Categorias, navegação e organização dos espaços da comunidade.',4,8,'entrega',16),

('tecnologia/analise-consultoria','tecnologia','Tecnologia',5,'Análise e consultoria técnica','Diagnóstico, viabilidade, arquitetura e planejamento de melhorias.',2,6,'entrega',1),
('tecnologia/desenvolvimento','tecnologia','Tecnologia',5,'Desenvolvimento','Implementação de solução ou evolução técnica de escopo definido.',8,40,'entrega',2),
('tecnologia/nova-funcionalidade','tecnologia','Tecnologia',5,'Nova funcionalidade','Criação ou alteração de recurso na plataforma.',8,24,'entrega',3),
('tecnologia/integracoes','tecnologia','Tecnologia',5,'Integrações e automações','APIs, pagamentos, WhatsApp, e-mail, sistemas externos e automações.',4,16,'entrega',4),
('tecnologia/interface-ux','tecnologia','Tecnologia',5,'Interface e experiência do usuário','Fluxos, interface, responsividade, acessibilidade e melhorias UX.',4,12,'entrega',5),
('tecnologia/dados-migracoes','tecnologia','Tecnologia',5,'Dados e migrações','Importação, exportação, correção, organização ou transferência de dados.',4,16,'entrega',6),
('tecnologia/configuracao-publicacao','tecnologia','Tecnologia',5,'Configuração e publicação','Deploy, domínio, servidor, ambiente e configurações técnicas.',2,6,'entrega',7),
('tecnologia/correcoes-manutencao','tecnologia','Tecnologia',5,'Correções e manutenção','Bugs, erros, lentidão, incompatibilidades e pequenos ajustes.',1,4,'entrega',8),
('tecnologia/testes-qualidade','tecnologia','Tecnologia',5,'Testes e revisão de qualidade','Testes funcionais e validação antes da publicação.',2,6,'entrega',9),
('tecnologia/discovery-requisitos','tecnologia','Tecnologia',5,'Discovery / Requisitos','Entendimento do problema, requisitos, critérios e priorização.',3,6,'entrega',10),

('gestao/gestao-projeto','gestao','Gestão, Estratégia e Atendimento',6,'Gestão de projeto','Acompanhamento de escopo, cronograma, prioridades, riscos e equipe.',2,4,'semana',1),
('gestao/reuniao-cliente','gestao','Gestão, Estratégia e Atendimento',6,'Reunião com cliente','Preparação, reunião e registro dos encaminhamentos.',1,2,'entrega',2),
('gestao/reuniao-interna','gestao','Gestão, Estratégia e Atendimento',6,'Reunião interna','Alinhamento da equipe sobre projeto/entregas.',0.5,1,'entrega',3),
('gestao/briefing','gestao','Gestão, Estratégia e Atendimento',6,'Briefing','Construção, detalhamento e validação do briefing.',1,2,'entrega',4),
('gestao/planejamento-campanha','gestao','Gestão, Estratégia e Atendimento',6,'Planejamento de campanha','Objetivos, conceito, públicos, canais, entregas e cronograma.',4,8,'entrega',5),
('gestao/gestao-backlog','gestao','Gestão, Estratégia e Atendimento',6,'Gestão de backlog','Priorização e organização das demandas.',1,2,'entrega',6),
('gestao/analise-resultados','gestao','Gestão, Estratégia e Atendimento',6,'Análise de resultados','Leitura de dados e construção de recomendações.',2,4,'entrega',7),
('gestao/relatorio-executivo','gestao','Gestão, Estratégia e Atendimento',6,'Relatório executivo','Síntese gerencial de resultados, aprendizados e próximos passos.',3,6,'entrega',8),
('gestao/apresentacao-cliente','gestao','Gestão, Estratégia e Atendimento',6,'Apresentação ao cliente','Preparação de material e apresentação.',2,4,'entrega',9),
('gestao/consultoria-estrategica','gestao','Gestão, Estratégia e Atendimento',6,'Consultoria / Recomendação estratégica','Análise de problema e orientação estratégica.',2,6,'entrega',10),
('gestao/pesquisa-benchmark','gestao','Gestão, Estratégia e Atendimento',6,'Pesquisa / Benchmark','Pesquisa de mercado, concorrentes, cases e referências.',2,4,'entrega',11),
('gestao/gestao-fornecedor','gestao','Gestão, Estratégia e Atendimento',6,'Gestão de fornecedor / parceiro','Briefing, acompanhamento, aprovação e interface.',1,3,'entrega',12),

('administrativo/contas','administrativo','Administrativo e Pessoas',7,'Contas a pagar e receber','Lançamentos, conferência, cobrança e acompanhamento.',0.5,2,'entrega',1),
('administrativo/nota-fiscal','administrativo','Administrativo e Pessoas',7,'Emissão de nota fiscal','Emissão, conferência e envio.',0.25,0.5,'entrega',2),
('administrativo/fechamento-financeiro','administrativo','Administrativo e Pessoas',7,'Fechamento financeiro mensal','Conciliação, fechamento e consolidação das informações.',4,8,'entrega',3),
('administrativo/folha-pagamento','administrativo','Administrativo e Pessoas',7,'Fechamento da folha de pagamento','Conferência de dados e processamento da folha.',3,6,'entrega',4),
('administrativo/folha-ponto','administrativo','Administrativo e Pessoas',7,'Fechamento da folha de ponto','Conferência de jornada, ajustes e fechamento.',2,4,'entrega',5),
('administrativo/contratos','administrativo','Administrativo e Pessoas',7,'Contratos – novo / renovação','Preparação, revisão, tramitação e organização.',2,4,'entrega',6),
('administrativo/cadastro-contrato','administrativo','Administrativo e Pessoas',7,'Cadastro de novo contrato','Registro do contrato e informações nos sistemas internos.',0.5,1,'entrega',7),
('administrativo/compras-cotacao','administrativo','Administrativo e Pessoas',7,'Compras / Cotação','Pesquisa, comparação, aprovação e contratação.',1,3,'entrega',8),
('administrativo/onboarding-colaborador','administrativo','Administrativo e Pessoas',7,'Onboarding de colaborador','Documentação, acessos, orientações e integração.',3,6,'entrega',9),
('administrativo/desligamento','administrativo','Administrativo e Pessoas',7,'Desligamento','Documentação, acessos e procedimentos de saída.',2,4,'entrega',10),
('administrativo/divulgacao-vaga','administrativo','Administrativo e Pessoas',7,'Divulgação de vaga','Preparação e publicação da oportunidade.',0.5,1,'entrega',11),
('administrativo/triagem-curriculos','administrativo','Administrativo e Pessoas',7,'Triagem de currículos','Análise inicial e shortlist.',2,4,'entrega',12),
('administrativo/entrevista','administrativo','Administrativo e Pessoas',7,'Entrevista','Preparação, entrevista e registro.',1,1.5,'entrega',13),
('administrativo/retorno-selecao','administrativo','Administrativo e Pessoas',7,'Retorno de processo seletivo','Comunicação e registros aos candidatos.',0.5,1,'entrega',14),
('administrativo/comunicacao-interna','administrativo','Administrativo e Pessoas',7,'Comunicação interna','Produção e distribuição de comunicação interna.',1,3,'entrega',15),
('administrativo/evento','administrativo','Administrativo e Pessoas',7,'Organização de ação / evento','Planejamento e coordenação operacional.',4,12,'entrega',16),
('administrativo/editais','administrativo','Administrativo e Pessoas',7,'Pesquisa de editais / inovação','Busca, triagem e avaliação de oportunidades.',2,4,'entrega',17),
('administrativo/relatorio','administrativo','Administrativo e Pessoas',7,'Relatório administrativo','Consolidação de informações e indicadores.',2,4,'entrega',18)
ON CONFLICT (catalog_key) DO UPDATE SET
  area_key = EXCLUDED.area_key, area_name = EXCLUDED.area_name, area_order = EXCLUDED.area_order,
  name = EXCLUDED.name, description = EXCLUDED.description, hours_min = EXCLUDED.hours_min,
  hours_max = EXCLUDED.hours_max, hours_unit = EXCLUDED.hours_unit, sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- 3. Seeding function
CREATE OR REPLACE FUNCTION public.enforce_service_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $limitfn$
DECLARE v_plan public.plans; v_count integer;
BEGIN
  IF NEW.team_id IS NULL OR NEW.is_catalog THEN RETURN NEW; END IF;
  v_plan := public.get_team_active_plan(NEW.team_id);
  IF v_plan IS NULL OR v_plan.max_services = -1 THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM public.services WHERE team_id = NEW.team_id AND NOT is_catalog;
  IF v_count >= v_plan.max_services THEN
    RAISE EXCEPTION 'PLAN_LIMIT_SERVICES: O plano % permite até % serviço(s). Faça upgrade para cadastrar mais.', v_plan.name, v_plan.max_services USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$limitfn$;

CREATE OR REPLACE FUNCTION public.seed_team_service_catalog(_team_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _area record;
  _item record;
  _folder_id uuid;
BEGIN
  SELECT created_by INTO _owner FROM public.teams WHERE id = _team_id;
  IF _owner IS NULL THEN RETURN; END IF;

  FOR _area IN
    SELECT DISTINCT area_key, area_name, area_order FROM public.service_catalog_items ORDER BY area_order
  LOOP
    INSERT INTO public.services (team_id, name, description, estimated_hours, price_cents, parent_id,
      is_folder, created_by, is_catalog, is_active, sort_order, catalog_key)
    VALUES (_team_id, _area.area_name, NULL, 0, 0, NULL, true, _owner, true, true, _area.area_order,
      'area/' || _area.area_key)
    ON CONFLICT (team_id, catalog_key) WHERE catalog_key IS NOT NULL DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order,
      is_catalog = true, is_active = true, is_folder = true
    RETURNING id INTO _folder_id;

    IF _folder_id IS NULL THEN
      SELECT id INTO _folder_id FROM public.services
       WHERE team_id = _team_id AND catalog_key = 'area/' || _area.area_key;
    END IF;

    FOR _item IN
      SELECT * FROM public.service_catalog_items WHERE area_key = _area.area_key ORDER BY sort_order
    LOOP
      INSERT INTO public.services (team_id, name, description, estimated_hours, price_cents, parent_id,
        is_folder, created_by, is_catalog, is_active, hours_min, hours_max, hours_unit, sort_order, catalog_key)
      VALUES (_team_id, _item.name, _item.description, GREATEST(1, CEIL(COALESCE(_item.hours_max, 1))::int), 0,
        _folder_id, false, _owner, true, true, _item.hours_min, _item.hours_max, _item.hours_unit,
        _item.sort_order, _item.catalog_key)
      ON CONFLICT (team_id, catalog_key) WHERE catalog_key IS NOT NULL DO UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description, estimated_hours = EXCLUDED.estimated_hours,
        parent_id = EXCLUDED.parent_id, is_folder = false, is_catalog = true, is_active = true,
        hours_min = EXCLUDED.hours_min, hours_max = EXCLUDED.hours_max, hours_unit = EXCLUDED.hours_unit,
        sort_order = EXCLUDED.sort_order;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_team_service_catalog(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_team_service_catalog(uuid) TO service_role;

-- 4. Backfill all existing teams
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT id FROM public.teams LOOP
    PERFORM public.seed_team_service_catalog(t.id);
  END LOOP;
END $$;

-- 5. Deactivate legacy services
UPDATE public.services SET is_active = false WHERE catalog_key IS NULL;

-- 6. Auto seed on new teams
CREATE OR REPLACE FUNCTION public.trg_seed_service_catalog_on_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_team_service_catalog(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_service_catalog_on_team ON public.teams;
CREATE TRIGGER seed_service_catalog_on_team
AFTER INSERT ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.trg_seed_service_catalog_on_team();

-- 7. Lock the catalog: no writes from the app
DROP POLICY IF EXISTS "Team admins and moderators can create services" ON public.services;
DROP POLICY IF EXISTS "Team admins and moderators can update services" ON public.services;
DROP POLICY IF EXISTS "Team admins can delete services" ON public.services;

REVOKE INSERT, UPDATE, DELETE ON public.services FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.services FROM anon;
GRANT SELECT ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;