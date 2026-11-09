# Fechar a Sprint 02 e entregar a Sprint 03 (Base financeira por projeto)

## Parte A — Pendências da Sprint 02

1. **Alerta em "Lançamentos e acesso"**: no cadastro de custos, um aviso no topo lista quem tem horas no mês mas está sem vínculo (interno/externo/prestador) ou sem custo/hora cadastrado. Cada pessoa vem com um atalho para cadastrar o que falta.
2. **Bloco "Horas e custos" no financeiro do admin**: ao abrir um projeto em /admin/finance, aparece o mesmo bloco que já existe dentro do projeto.
3. **Conferência no navegador** do bloco "Horas e custos", com dados reais da LIMA TESTES (resumo, auditoria, pendências, CSV).

## Parte B — Sprint 03

### S3.1 Configuração por projeto
- Cada projeto ganha alíquota de impostos, % de custos variáveis e meta de margem, cada uma com data de início de validade.
- O histórico de valores fica guardado. Quando o projeto não tem configuração própria, valem os parâmetros da equipe.
- A edição fica dentro da aba do projeto e exige a permissão de gestão financeira.

### S3.2 Cálculo por projeto
- Nova leitura consolidada por projeto e por mês, somando todos os quadros vinculados naquele mês. Entram faturamento, despesas diretas, rateios, horas e custo de pessoal, este já pelo corte por mês da Sprint 02.
- O motor de cálculo atual é reaproveitado sem mudar as fórmulas, então os números continuam iguais em todas as telas.
- A Visão Geral e a Rentabilidade passam a mostrar uma linha por projeto. Os quadros sem projeto continuam no grupo "Sem projeto".
- A leitura antiga, por quadro, continua funcionando.

### S3.3 API v1 para o painel externo
- Um endereço de leitura, autenticado com as chaves de API que o SoMA já usa, com permissão específica para leitura financeira.
- Contrato: `projeto × mês`, com status (aberto/fechado), totais em centavos, versão e data de geração.
- Tem paginação por cursor e sempre devolve a mesma resposta para o mesmo mês fechado.
- Cada chave só enxerga a própria equipe, e todo acesso fica registrado.

### S3.4 Aba "Base financeira" no projeto
- O painel atual vira uma aba completa com quatro seções: indicadores do mês (resultado, margem e régua da meta), Horas e custos, Despesas e rateios do projeto, e Configuração.
- Ganha um seletor de mês, no mesmo padrão visual do restante do financeiro.

### S3.5 Testes
- Testes de unidade para a consolidação e o arredondamento de centavos em vários quadros.
- Testes no banco para o isolamento entre equipes e para as permissões da API e da leitura por projeto.
- Conferência da aba nova no navegador.

## Fora do escopo (Sprint 04)
- Fechamento mensal por projeto.
- Consumidor simulado do painel externo.
- Homologação dos 3 cenários.
- Migração de dados antigos.

## Detalhes técnicos
- Migração aditiva: tabela `finance_project_settings` (project_id, valid_from, tax_rate, variable_rate, margin_target), com vigências que não se sobrepõem, RLS e grants. RPCs `get_project_finance_overview(project_id, from, to)` e `admin_finance_scopes` reaproveitando o `_finance_overview_all` e o `_finance_time_slices`.
- Edge `finance-api-v1` (npm imports): valida a chave com hash, escopo `finance:read` e paginação por cursor. Registra em `api_logs`.
- Arquivos novos: `src/lib/finance/projectRollup.ts` com testes e `ProjectFinanceTab.tsx`. Ajustes em `FinanceManage.tsx`, `AdminFinance.tsx` e `Finance.tsx`.
- Atualizar o AGENTS.md (projeto como unidade de leitura e contrato da API) e o roadmap.md.
