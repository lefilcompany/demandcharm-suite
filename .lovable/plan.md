# Converter demanda em subdemanda

Hoje só é possível criar subdemandas do zero dentro de uma demanda pai. Vamos adicionar a possibilidade de pegar uma demanda **já existente** e transformá-la em subdemanda de outra demanda do mesmo quadro, com um seletor para escolher qual demanda receberá o vínculo.

## Fluxo de usuário

1. Na tela **Detalhes da Demanda** (`/demands/:id`), no menu de ações (⋯) da demanda, adicionar a opção **"Tornar subdemanda de..."**.
   - Visível apenas quando a demanda:
     - Não é já uma subdemanda (`parent_demand_id` nulo);
     - Não possui subdemandas próprias (para não criar hierarquia de 2 níveis, que hoje não é suportada pela UI);
     - Usuário tem permissão de editar a demanda (mesma regra do editar hoje).
   - Quando a demanda já é subdemanda, a opção muda para **"Desvincular da demanda pai"**.

2. Ao clicar, abre um modal **"Vincular como subdemanda"** com:
   - Combobox pesquisável listando demandas do **mesmo quadro** (usa `useDemandsList(boardId)`), mostrando `#seq — título`.
   - Exclui da lista: a própria demanda, demandas que já são subdemandas (têm `parent_demand_id`) e a lista respeita `archived=false`.
   - Aviso curto: "A demanda passará a ser subdemanda da demanda selecionada. Você pode reverter depois."
   - Botões **Cancelar** / **Vincular** (laranja `#F28705`, desabilitado enquanto nada selecionado).

3. Ao confirmar, atualiza `parent_demand_id` da demanda para o id escolhido, invalida os caches relevantes e mostra toast de sucesso. A tela recarrega os dados e passa a exibir o cabeçalho de subdemanda existente.

4. **Desvincular**: confirma via dialog simples e seta `parent_demand_id = null`.

## Alterações técnicas

- **Hook novo** `useConvertToSubdemand` em `src/hooks/useSubdemands.ts`:
  - `mutationFn` faz `update demands set parent_demand_id = :parentId where id = :childId`;
  - Validações no client antes do update: parent está no mesmo `board_id`, parent não é a própria demanda, parent não tem `parent_demand_id` (é raiz), child não tem subdemandas (`select count from demands where parent_demand_id = child`).
  - `onSuccess`: invalidar `["demand", childId]`, `["subdemands", parentId]`, `["subdemands", oldParentId]` (se houver), `["demands"]`, `["kanban-*"]` (mesmo padrão dos outros mutations).
  - Hook irmão `useUnlinkSubdemand` que seta `parent_demand_id = null`.

- **Componente novo** `src/components/LinkAsSubdemandDialog.tsx`:
  - Reaproveita `Command`/`Popover` (shadcn) para o combobox com busca.
  - Recebe `demandId`, `boardId`, `currentParentId`, `hasSubdemands`, `open`, `onClose`.
  - Filtra a lista de `useDemandsList` removendo a própria demanda e as que têm `parent_demand_id` (extender o select do hook para trazer `parent_demand_id`, ou criar `useDemandsList` com flag `excludeSubdemands`).

- **Ajuste** em `src/hooks/useDemandsList.ts`: incluir `parent_demand_id` no `select` para permitir a filtragem no dialog. Mantém compatibilidade com usos atuais (só adiciona campo).

- **Integração** em `src/pages/DemandDetail.tsx`:
  - Importar o novo dialog e hooks;
  - Adicionar item no menu de ações existente da demanda (⋯) — "Tornar subdemanda de..." ou "Desvincular da demanda pai" conforme o caso, gated pelas condições acima;
  - Estado local `showLinkParentDialog`.

## Regras / restrições respeitadas

- Nível máximo de hierarquia continua **1** (subdemanda de subdemanda não é permitido) — validado tanto no client quanto por checagem de estado antes de habilitar o botão.
- Permissões: só quem já pode editar a demanda vê a ação (mesma verificação usada para editar título/descrição).
- Sem mudanças em RLS: `update demands` já respeita as policies existentes de edição.
- Sem alterações em edge functions, timers, ou fluxo de status — apenas reparent.

## Fora do escopo

- Mover subdemanda de um pai para outro em um único passo (fica coberto por desvincular + vincular).
- Suporte a hierarquia com mais de 1 nível.
- Ação em massa a partir do Kanban.
