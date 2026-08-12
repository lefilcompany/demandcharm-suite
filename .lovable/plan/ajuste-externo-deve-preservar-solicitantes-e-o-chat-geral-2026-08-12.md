# Ajuste externo deve preservar solicitantes e o chat Geral

Hoje, quando uma demanda entra em "Em Ajuste", o chat pode ficar apenas com o canal Interno e os solicitantes deixam de aparecer como responsáveis. Isso deve acontecer somente quando o ajuste nasce de uma **Aprovação Interna**. Ajuste vindo de **Aprovação do Cliente / externa** deve manter os solicitantes e a aba **Geral**.

## Passo 1 — Confirmar por que os solicitantes somem

O código do fluxo de ajuste (diálogo de ajuste no Kanban e na tela da demanda) e os gatilhos do banco em `demands` não apagam responsáveis. A causa ainda não está confirmada, então o primeiro passo é verificar em uma demanda real que passou por aprovação externa e foi para ajuste:

- conferir se os registros de responsáveis com papel de solicitante continuam existindo no banco;
- se existirem, o problema é de exibição/permissão de leitura (regra de acesso a responsáveis/perfis para solicitantes);
- se não existirem, identificar qual caminho os removeu (edição de responsáveis, aprovação, propagação para subdemandas).

A correção sai daí: manter os solicitantes como responsáveis após o ajuste, sem alterar a regra de "no mínimo um responsável".

## Passo 2 — Registrar a origem do ajuste

Ao solicitar um ajuste, gravar na própria solicitação de ajuste de onde ela veio (etapa anterior e se essa etapa era de aprovação interna ou externa). Isso vale para os dois pontos onde o ajuste é solicitado: o diálogo do Kanban e a tela de detalhe da demanda.

Sem esse dado não é possível diferenciar "ajuste interno" de "ajuste após aprovação do cliente" nas demandas já existentes — para os casos antigos, sem informação de origem, o comportamento será o mais permissivo (mantém o chat Geral).

## Passo 3 — Nova regra do chat

O chat da demanda passa a exibir **somente o canal Interno** quando as duas condições forem verdadeiras:

1. o ajuste mais recente da demanda veio de uma etapa de **aprovação interna**; e
2. nenhum participante da demanda (criador + responsáveis) é solicitante.

Em qualquer outro caso — inclusive ajuste originado de aprovação externa — a aba **Geral** continua disponível e é o canal padrão.

## Detalhes técnicos

- Origem do ajuste: acrescentar `origin_status_name` e `origin_adjustment_type` ao `metadata` da interação `adjustment_request`, em `src/components/KanbanAdjustmentDialog.tsx` e em `handleRequestAdjustment` de `src/pages/DemandDetail.tsx`. O tipo da etapa anterior vem de `board_statuses.adjustment_type` da coluna de origem.
- `src/components/DemandChat.tsx`: nova consulta da última interação `adjustment_request` da demanda; `internalOnly` passa a ser `allParticipantsInternal && canSeeInternal && lastAdjustmentOrigin === "internal"`. Se não houver ajuste registrado ou a origem for externa/desconhecida, `showGeneralTab` permanece verdadeiro.
- Nenhuma mudança em políticas de acesso ao canal interno: solicitante continua sem ver o canal Interno.
- Correção dos responsáveis conforme o diagnóstico do Passo 1 (ajuste de código ou de política de leitura), sem migrações destrutivas.
