# Duplicar demanda (com subdemandas)

Adiciona a ação "Duplicar" numa demanda, criando uma cópia completa no mesmo quadro, com novos identificadores e título prefixado com `[CÓPIA]`.

## Onde fica a ação

- Menu do card no Kanban (`KanbanCardMenu`), junto de "Abrir" / "Compartilhar".
- Menu de ações da tela de detalhe da demanda.

Ao clicar, abre um modal de confirmação "Duplicar demanda".

## Modal de duplicação

- Mostra o título que será criado: `[CÓPIA] <título original>`.
- Opção (checkbox): **Copiar anexos** — desmarcada por padrão; se marcada, os arquivos da demanda (e das subdemandas) são copiados para a nova demanda.
- Prazo:
  - Se o prazo original ainda não venceu (ou não existe), é copiado como está, sem perguntar nada.
  - Se o prazo estiver vencido, o modal exige uma nova data antes de confirmar. Quando houver subdemandas vencidas, o mesmo deslocamento de dias aplicado ao pai é aplicado às subdemandas vencidas; as não vencidas mantêm a data.
- Botão "Duplicar" com estado de carregamento e resumo do que será copiado.

## O que é copiado

Da demanda principal e de cada subdemanda:

- Título (prefixo `[CÓPIA]` apenas no pai), descrição, prioridade, serviço, etapa atual do quadro, prazo (conforme regra acima), link de reunião.
- Responsável (is_primary) e seguidores.
- Subtarefas / checklist — copiadas com todos os itens marcados como não concluídos.
- Subdemandas, na mesma ordem, com todas as características acima.
- Dependências: as mesmas demandas bloqueadoras do original. Dependências internas entre subdemandas do mesmo conjunto são remapeadas para as novas cópias.
- Anexos, somente se o usuário marcar a opção.

O que **não** é copiado (por serem históricos): comentários/chat, tempo cronometrado, histórico de mudanças de etapa, data de entrega, número sequencial (a cópia recebe um novo número do quadro) e o estado de arquivada.

Depois de criada, a cópia é uma demanda normal e pode ser editada livremente.

## Depois de duplicar

- Toast de sucesso com ação "Abrir cópia".
- As listas de Kanban, demandas e subdemandas são atualizadas.

## Detalhes técnicos

- Nova função no banco `public.duplicate_demand(p_demand_id uuid, p_new_due_date timestamptz, p_subdemand_due_dates jsonb)` como `SECURITY DEFINER`, executando tudo numa única transação: insere o pai, as subdemandas, `demand_assignees`, `demand_subtasks` (com `completed=false`) e `demand_dependencies`, retornando o id da nova demanda e o mapa `id antigo → id novo`. Permissão de execução apenas para `authenticated`, com validação de que o usuário é membro do quadro (`is_board_member`) e respeitando os limites de plano existentes (`enforce_demand_monthly_limit` continua ativo por trigger).
- Anexos: passo separado no cliente, após a RPC. Para cada linha de `demand_attachments` das demandas de origem, o arquivo é baixado do storage e reenviado num novo caminho vinculado à nova demanda, inserindo as linhas correspondentes. Falha em um anexo não invalida a duplicação — apenas alerta no toast.
- Novo hook `useDuplicateDemand` em `src/hooks/useDemands.ts` (RPC + anexos + invalidação de `demands`, `subdemands`, `demand-attachments`).
- Novo componente `src/components/DuplicateDemandDialog.tsx` com a lógica do modal, usado pelo `KanbanCardMenu` e pela tela de detalhe.
