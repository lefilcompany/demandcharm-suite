# Pasta de serviços criada não aparece na lista

## O que foi verificado

A pasta "Teste" foi realmente criada no banco (equipe LeFil Company, 03/08 14:17), com `parent_id` nulo e 0 horas. Ou seja: o salvamento funcionou — o problema é só de exibição.

## Causa

Hoje o sistema não guarda em lugar nenhum que um registro é "pasta". A tela decide isso na hora, olhando se o serviço tem filhos:

- `src/hooks/useServices.ts`: `isCategory = (tem pelo menos 1 serviço filho)`
- `src/pages/ServicesManagement.tsx`: a seção de pastas lista só itens com `isCategory`; o resto cai em "serviços independentes"

Como uma pasta nova nasce vazia, ela nunca tem filhos e por isso é exibida como um serviço solto, não como pasta.

## Correção

1. Banco: adicionar a coluna `is_folder` (boolean, default `false`) na tabela `services`, e marcar como pasta os registros existentes que já têm filhos (backfill).
2. `src/hooks/useServices.ts`: incluir `is_folder` no tipo `Service`, aceitar o campo na criação/edição e calcular `isCategory = is_folder || tem filhos` (mantém compatibilidade com dados antigos).
3. `src/pages/ServicesManagement.tsx`: enviar `is_folder: true` ao criar/editar pela caixa de diálogo de pasta; serviços normais continuam com `false`.
4. Serviços selecionáveis (`useSelectableServices`) continuam excluindo pastas — inclusive as vazias — para que uma pasta nunca apareça como opção ao criar demanda.

## Verificação

Criar uma pasta nova em `/teams/:id/services` e confirmar que ela aparece imediatamente na seção de pastas (vazia, com a mensagem "Arraste serviços para esta pasta"), que a pasta "Teste" já existente passa a aparecer lá, e que arrastar um serviço para dentro continua funcionando.
