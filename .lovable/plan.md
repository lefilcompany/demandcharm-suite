# Plano — Fila dinâmica por score no Kanban

## Objetivo
Tornar o **Score de prioridade** a ordenação padrão de todas as colunas do Kanban, mantendo as demais ordenações disponíveis como alternativas manuais.

## Implementação
- Alterar a ordenação inicial das colunas para `Score de prioridade`, inclusive ao abrir ou recarregar o Kanban.
- Recalcular a posição sempre que prazo, prioridade ou esforço mudar, usando os dados atualizados que já chegam em tempo real ao quadro.
- Adicionar uma atualização periódica leve da fila enquanto o Kanban estiver aberto, sem gravar scores estáticos no banco.
- Preservar busca, filtros, agrupamento de demandas/subdemandas, arrastar entre etapas e todas as outras opções de ordenação.
- Garantir desempate estável entre scores iguais para evitar cartões mudando de posição sem motivo.

## Detalhes técnicos
- O score continuará calculado no frontend pela fórmula existente, sem cron e sem coluna persistida.
- Edições recebidas pelo canal em tempo real provocarão nova ordenação imediatamente.
- A atualização periódica apenas refaz a ordenação em memória; não gera requisições adicionais ao banco.

## Validação
- Confirmar que o score é a ordenação inicial.
- Confirmar que prazo, prioridade e esforço alterados reposicionam a demanda.
- Confirmar que as outras ordenações continuam selecionáveis.
- Executar os testes relevantes e verificar o build do preview.
