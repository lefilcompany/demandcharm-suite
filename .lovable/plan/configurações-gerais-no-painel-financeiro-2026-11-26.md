# Configurações Gerais no Painel Financeiro

## O que o usuário verá
- Nova aba **Configurações Gerais** no Painel Financeiro (última posição, após Simulador).
- **Padrões da equipe**: alíquota de impostos, percentual variável, meta de margem, desconto máximo, % de rateio e custo hora/homem de referência — com histórico por data de vigência (mudanças valem a partir do mês escolhido, meses fechados não mudam).
- **Perfis de configuração (presets)**: lista de cartões com nome, descrição e os valores acima (alíquota, variável, meta de margem). Ações: criar, editar, duplicar, marcar como padrão e arquivar.
- **Criação de projeto**: no modal "Novo projeto", novo campo **Perfil financeiro** (pré-selecionado com o preset padrão). Os valores do perfil são copiados para o projeto no momento da criação; editar o preset depois não altera projetos já criados.
- **Permissões**: somente o Gestor financeiro (e o dono, que por padrão tem esse perfil) edita. Analista e Leitor veem a aba em modo leitura; quem não tem acesso financeiro não vê a aba nem o campo de perfil.

## Detalhes técnicos
- Nova tabela `finance_config_presets` (team_id, name, description, tax_rate, variable_rate, margin_target, max_discount, is_default, archived_at, created_by), com GRANTs, RLS `(select auth.uid())`: leitura via `can_read_finance_structure`/módulo financeiro, escrita via `has_finance_permission(..., 'settings.manage')` (gestor). Índice único parcial: um único `is_default` por equipe.
- Coluna `projects.finance_preset_id` (nullable, apenas referência de origem).
- Ajustar `finance_seed_project_settings` para semear `finance_project_settings` a partir do preset escolhido; sem preset, mantém o comportamento atual (padrões da equipe).
- Seed: um preset "Padrão" por equipe a partir dos `finance_team_defaults` vigentes.
- Front: `src/components/finance/GeneralSettings.tsx` (reaproveita `TeamDefaultsPanel` + nova `PresetsManager`), hook `useFinancePresets`, entrada `settings` em `SECTIONS` de `Finance.tsx` (ícone `SlidersHorizontal`), seletor em `CreateFolderDialog.tsx` passando o preset em `useCreateFolder`.
- Testes: preset padrão único; projeto criado herda os valores do preset; analista não consegue gravar.
- Registrar a regra em `AGENTS.md` (presets são copiados na criação, nunca vinculados ao vivo).
