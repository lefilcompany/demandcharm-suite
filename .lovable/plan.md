# Catálogo de Serviços oficial (fixo) do SoMA

Substituir a lista de serviços por um catálogo único, igual para todas as equipes, que ninguém pode
criar, editar ou apagar pela plataforma. Os serviços continuam apenas selecionáveis na criação de
demanda e visíveis na página de Serviços.

## O que o usuário vai ver

- Na criação de demanda (e subdemanda, solicitação, templates, filtros): apenas os serviços do
  catálogo, organizados por área.
- Na página de Serviços: lista somente para leitura, agrupada por área, com descrição e faixa de
  horas de referência. Sem botões de criar, editar, excluir, criar pasta ou arrastar.
- Serviços antigos que não estão no catálogo: somem das listas de seleção, mas as demandas já
  criadas continuam mostrando o serviço que tinham.

## Catálogo a ser cadastrado

8 áreas (pastas) com os serviços do arquivo enviado:

1. Conteúdo e Criação — Planejamento de conteúdo, Post Feed, Post Carrossel, Post Story,
   Post Feed + Story, Reels, Vídeo com captação, Animação / Motion, Copy / Redação, Newsletter,
   Landing Page, Peça de anúncio, Desdobramento / Redimensionamento, Identidade visual / KV,
   Diagramação, Material impresso, Ícones / Elementos gráficos, Locução, Pesquisa / Referências,
   Revisão / Ajustes de conteúdo, Publicação / Agendamento.
2. Mídia, Performance e Retail Media — Planejamento de mídia, Configuração de campanha, Meta Ads,
   Google Ads, Retail Media / Marketplace, Criativo de performance, Teste A/B,
   Otimização de campanha, Monitoramento de campanha, Configuração de conversão / Pixel / Tag.
3. Monitoramento e Inteligência — Ronda de monitoramento, Gestão de crise,
   Configuração de monitoramento, Análise de menções / sentimento, Análise de tendências / temas,
   Alerta de reputação, Relatório de monitoramento, Relatório de crise.
4. Comunidades — Planejamento da comunidade, Gestão da comunidade, Moderação,
   Interação com membros, Onboarding de membros, Ação de engajamento, Conteúdo para comunidade,
   Live / Encontro, Gamificação / Badges, Gestão de embaixadores, Pesquisa / Enquete com membros,
   Curadoria de conteúdo, Relatório de comunidade, Análise LeKPIs, Jornada do membro / UX,
   Arquitetura da comunidade.
5. Tecnologia — Análise e consultoria técnica, Desenvolvimento, Nova funcionalidade,
   Integrações e automações, Interface e experiência do usuário, Dados e migrações,
   Configuração e publicação, Correções e manutenção, Testes e revisão de qualidade,
   Discovery / Requisitos.
6. Gestão, Estratégia e Atendimento — Gestão de projeto, Reunião com cliente, Reunião interna,
   Briefing, Planejamento de campanha, Gestão de backlog, Análise de resultados,
   Relatório executivo, Apresentação ao cliente, Consultoria / Recomendação estratégica,
   Pesquisa / Benchmark, Gestão de fornecedor / parceiro.
7. Administrativo e Pessoas — Contas a pagar e receber, Emissão de nota fiscal,
   Fechamento financeiro mensal, Fechamento da folha de pagamento, Fechamento da folha de ponto,
   Contratos – novo / renovação, Cadastro de novo contrato, Compras / Cotação,
   Onboarding de colaborador, Desligamento, Divulgação de vaga, Triagem de currículos, Entrevista,
   Retorno de processo seletivo, Comunicação interna, Organização de ação / evento,
   Pesquisa de editais / inovação, Relatório administrativo.

Cada serviço guarda a descrição e a faixa de horas do arquivo (ex.: 0,5–2h; 2–4h/semana;
0,5–2h/dia). A unidade (por entrega / por semana / por dia) fica registrada junto.

## Detalhes técnicos

Banco (`public.services`):
- Novas colunas: `is_catalog boolean default false`, `is_active boolean default true`,
  `hours_min numeric`, `hours_max numeric`, `hours_unit text` (entrega/semana/dia),
  `sort_order int`, `catalog_key text` (identificador estável do item do catálogo).
- `estimated_hours` continua preenchido (arredondado do `hours_max`) para não quebrar cálculos
  existentes.
- Seed do catálogo em todas as 12 equipes existentes (pastas + serviços, `board_id = null`),
  idempotente por `(team_id, catalog_key)`.
- Trigger `after insert on public.teams` que semeia o catálogo em novas equipes.
- Os 75 serviços atuais fora do catálogo recebem `is_active = false` (mantidos para histórico).
- RLS/permissões: remover `INSERT`/`UPDATE`/`DELETE` de `authenticated` em `services`
  (leitura mantida para membros da equipe); alterações passam a ser feitas apenas por migração.

Frontend:
- `src/hooks/useServices.ts`: filtrar `is_active = true` nas listas de seleção; expor
  `hours_min/hours_max/hours_unit`; remover (ou neutralizar) os hooks de criar/editar/excluir.
- `src/pages/ServicesManagement.tsx`: virar tela somente leitura — sem diálogos de criar/editar,
  sem exclusão, sem drag-and-drop, sem botão de pasta; exibir faixa de horas em vez de `Xh`.
- Ajustar os pontos que hoje chamam criação/edição de serviço: `CreateBoardWizard`,
  `CreateBoardDialog`, `BoardScopeConfig`, `FirstBoardModal`, `Store`, `TemplateManager` —
  passar a apenas selecionar do catálogo.
- Ferramentas MCP `create_service` / `update_service` / `delete_service`
  (`src/lib/mcp/tools/services/index.ts`): passam a retornar erro de operação não permitida;
  `list_services` / `get_service` seguem funcionando.
- Modal do primeiro quadro que exige serviços cadastrados deixa de ser necessária (toda equipe já
  nasce com o catálogo); ajustar essa verificação.

## Verificação

- Página de Serviços de uma equipe mostra as 8 áreas com os itens, sem nenhum botão de edição.
- Criar demanda: seletor lista os serviços do catálogo agrupados por área.
- Demanda antiga com serviço fora do catálogo continua exibindo o serviço.
- Tentativa direta de criar/editar serviço (API/MCP) é recusada.
