# Inteligência Financeira — Fase 3: Simulador de Precificação

Adicionar a aba **Simulador de Precificação** às telas financeiras da equipe e do administrador global. A simulação não altera receitas, despesas ou demandas reais.

## O que será entregue
- Cenário vinculado a um quadro/projeto autorizado, com nome da proposta e cliente como identificação opcional.
- Entradas: receita estimada, alíquota de impostos, percentual de custos variáveis, despesas diretas, custos compartilhados e meta de margem.
- Planejamento de equipe por horas e custo/hora. Quem tem acesso a custos individuais pode usar os custos cadastrados de uma competência; os demais trabalham apenas com estimativas agregadas, sem receber salários ou valores individuais.
- Resultados em tempo real: receita líquida, custo da equipe, custo total, resultado, margem estimada, distância da meta e **preço mínimo para atingir a meta**.
- Aviso quando impostos + custos variáveis + meta chegam a 100%: o preço mínimo fica indisponível, sem divisão inválida. Receita zero também não produz uma margem fictícia.
- Salvar, renomear e excluir cenários, com confirmação na exclusão; reabrir os valores salvos e comparar até três cenários lado a lado.
- Exportação CSV dos cenários selecionados, somente com autorização de exportação em todos os quadros envolvidos.

## Experiência visual
Manter a identidade grafite/laranja das telas financeiras. Formulário organizado por receita, equipe e despesas, com resultado destacado e régua da meta. Na comparação, colunas alinhadas mostram preço, custos, resultado e margem. Valores brasileiros, estados de carregamento, ausência de cenários e erro com nova tentativa.

## Acesso e proteção
- Somente quadros autorizados aparecem nas opções; as mesmas verificações também acontecem no backend.
- Reutilizar permissões financeiras existentes: acesso de leitura ao quadro para simular e consultar cenários; autorização de lançamento de faturamento para salvar/alterar/excluir; autorização específica para consultar custos individuais; autorização de exportação para CSV.
- Cenários persistem apenas o planejamento financeiro agregado, sem cópias de salários, nomes ou custos individuais. A seleção de pessoas serve para montar o custo estimado, não para criar uma nova fonte de dados pessoais.
- Mudanças nos custos cadastrados não alteram cenários já salvos: os valores representam a estimativa daquela versão.
- Operações de gravação ficam auditadas. Não haverá alteração dos papéis existentes nem acesso financeiro automático.

## Detalhes técnicos
- Reutilizar `engine.ts`, inclusive `minimumPrice`: **P = C / (1 − t − r − m)**, onde C são custos que não variam com a receita. Separar custos variáveis para não contá-los duas vezes.
- Reutilizar `get_finance_people` para leitura de custos autorizados e os componentes financeiros e de formulário atuais.
- Criar armazenamento complementar de cenários, vinculado à equipe e ao quadro, com valores agregados, autoria e datas. Migração aditiva, grants explícitos, RLS e validação de escopo/permissões no backend; reutilizar a auditoria financeira.
- Implementar cálculo puro da simulação e testes: impostos demonstrativos de 21%, meta inicial de 40%, preço mínimo, custos variáveis, receita zero, denominador inválido e preservação dos valores salvos.
- Verificar gravação, leitura, comparação e exportação na tela autenticada, além das verificações de acesso no backend.

## Próxima fase, fora desta entrega
Fechamento mensal, congelamento das competências e ajustes posteriores auditáveis ficam para a Fase 4. O simulador não representa faturamento efetivo nem fechamento contábil.
