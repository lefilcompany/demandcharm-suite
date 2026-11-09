# Finanças mais limpas — mesmas telas e abas, menos ruído

Nenhuma aba, página, número ou ação é removida. Mudam hierarquia, espaçamento, agrupamento e consistência.

## Direção visual
"Livro-caixa calmo": fundo claro, cartões brancos com borda fina e sem sombra pesada, uma única faixa grafite por tela (o resumo principal), laranja SoMA só para meta, alerta e ação primária. Números em JetBrains Mono tabular; títulos em Barlow Condensed usados com parcimônia. Assinatura mantida: a régua de margem x meta.

## O que melhora em cada lugar

**Cabeçalho e navegação (todas as abas)**
- Cabeçalho em duas linhas: título + equipe à esquerda; período, quadro e CSV agrupados numa barra de filtros única à direita.
- Abas viram uma barra sublinhada (sem "pílula" cinza), rótulos encurtados com nome completo no tooltip: Visão geral, Por projeto, Por quadro, Pessoas, Rateios, Simulador, Fechamento, Lançamentos.
- Aba ativa guardada na URL, para voltar à mesma aba após recarregar.

**Visão geral**
- Faixa grafite com 6 números mais respirada; "−" e "=" ficam como sinais discretos para ler o DRE de cima para baixo.
- Avisos (horas sem custo, etc.) num único componente de aviso padronizado.
- "Horas previstas × realizadas" ganha mini-barra de progresso em vez de texto solto.

**Por projeto / Por quadro (tabelas)**
- Cabeçalho fixo ao rolar, primeira coluna fixa, colunas de dinheiro agrupadas (Receita | Custos | Resultado) com divisores leves, linhas mais baixas, resultado negativo em vermelho e status como etiqueta pequena.
- Estados vazio/erro/carregando padronizados.

**Pessoas, Rateios, Simulador, Fechamento**
- Mesmo esqueleto: resumo no topo, conteúdo em cartões com título curto + explicação de uma linha.
- Simulador: entradas à esquerda, resultado fixo à direita (sticky) em telas largas.
- Fechamento: checklist em lista compacta com ícone de status em vez de 8 cartões grandes.
- Campos de mês nativos substituídos pelo seletor de mês já criado (consistência).

**Lançamentos e acesso**
- Formulários agrupados em seções recolhíveis (Custos, Receitas, Despesas, Despesas compartilhadas, Vínculos, Acesso, Chave da API), com contador em cada seção.

**Tela de entrada do admin e área financeira dentro do projeto**
- Cartões de projeto/quadro com mais respiro; as 4 abas do projeto seguem o mesmo estilo sublinhado.

## Detalhes técnicos
- Novos primitivos em `src/components/ops/`: `FinanceSection` (título + descrição + ações), `FinanceNotice` (aviso/erro/vazio), `FinanceTabs` (abas sublinhadas), `MoneyCell`.
- Ajustes de tokens em `index.css` (bordas, superfícies, densidade de tabela); sem cores fixas.
- Arquivos: `Finance.tsx`, `AdminFinance.tsx`, todos em `src/components/finance/*`, `OpsParts.tsx`.
- Sem mudança de banco, regras, cálculos ou permissões; os 51 testes atuais continuam valendo.
- Verificação final no navegador (1167×674 e celular) em cada aba.
