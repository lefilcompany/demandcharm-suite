# Importar demandas de documento: P0/P1/P2, esforço pela IA e escolha de responsáveis

A importação já existe na página **Demandas** ("Importar de documento"). Este plano ajusta o que falta.

## O que muda para o usuário
1. **Envio:** aceita DOCX, PDF e Excel (XLSX/XLS), até 10 MB, escolhendo o quadro de destino.
2. **Prioridade P0/P1/P2:** o agente lê no documento P0 → **alta**, P1 → **média**, P2 → **baixa**. Sem marcação, fica média. Na lista aparece o selo P0/P1/P2 ao lado da prioridade.
3. **Esforço calculado pelo agente:** cada demanda recebe um esforço na escala usada no SoMA (1, 2, 3, 5, 8, 13, 21), estimado pelo tamanho e complexidade descritos, com uma justificativa curta ("Integração com 3 sistemas"). Dá para ajustar na revisão.
4. **Revisão em lista antes de criar** (nada é criado sem confirmar):
   - Uma linha por demanda: código P, título, descrição curta (expande ao clicar), serviço, prazo, esforço e **responsável** em destaque.
   - Coluna de responsável com busca pelos membros do quadro; linhas sem responsável ficam marcadas em laranja e o contador no topo mostra "N sem responsável".
   - **Seleção em massa:** marcar várias linhas e "Atribuir responsável" de uma vez.
   - Filtro rápido: Todas · Sem responsável · P0 · P1 · P2.
   - O botão "Criar N demandas" só fica liberado quando todas têm responsável e as demais validações (descrição ≥ 20 caracteres, serviço quando obrigatório).
5. **Criação:** igual à atual — uma a uma, com progresso e resumo (criadas / com erro).

## Visual
- Dentro do padrão SoMA (laranja #F28705, escuro #1D1D1D). Selos P0 vermelho, P1 âmbar, P2 cinza; esforço como pílula numérica; linha sem responsável com borda lateral laranja. Diálogo largo (max-w-6xl) com lista rolável e cabeçalho fixo com contadores e ações em massa.

## Detalhes técnicos
- `extract-demands-from-document`: prompt e schema passam a pedir `priority_code` (P0/P1/P2 ou null), `effort_points` (enum 1,2,3,5,8,13,21) e `effort_reason`; mapeamento P→prioridade feito no servidor em função pura também usada no front; esforço inválido cai para o mais próximo da escala; responsável sugerido pelo nome continua como pré-seleção editável.
- `ImportDemandsDialog.tsx`: novos campos `effort_points`, `effort_reason`, `priority_code`; seleção múltipla, atribuição em massa, filtros e bloqueio por responsável; `effort_points` enviado em `useCreateDemand` (verificar se o hook aceita o campo e incluir se não).
- Teste vitest para o mapeamento P0→alta, P1→média, P2→baixa, sem código→média e arredondamento do esforço para a escala.
