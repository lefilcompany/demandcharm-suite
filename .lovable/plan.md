## Diagnóstico confirmado

- A conta `vinicius.souza.ext@lefil.com.br` existe e está apenas na equipe **LeFil Company**.
- Ela participa de **36 quadros** nessa equipe.
- Existem demandas ativas nesses quadros; a conta tem demandas próprias/atribuídas e também acesso administrativo aos quadros.
- As permissões críticas usadas pelas políticas de acesso (`get_user_board_ids`, `get_user_team_ids`, `is_team_member`) já têm execução para usuários autenticados.
- O problema mais provável está no frontend da tela `/demands`: a tela depende do quadro selecionado salvo/local e de filtros persistidos, mas não faz uma recuperação robusta quando a seleção/filtros ficam incompatíveis com o estado real da conta.

## Plano de correção

1. **Tornar a seleção de equipe/quadro resiliente**
   - Ajustar `TeamContext` para ordenar equipes de forma estável.
   - Garantir que a equipe selecionada salva no navegador seja validada contra as equipes reais carregadas.
   - Ajustar `BoardContext` para limpar/substituir um quadro salvo que não pertence mais à equipe atual ou que não existe mais para o usuário.

2. **Melhorar fallback da tela `/demands`**
   - Quando não houver quadro selecionado, mas existirem quadros disponíveis, selecionar automaticamente um quadro válido.
   - Se a tela estiver vazia por causa de filtros salvos, mostrar um estado claro e disponibilizar ação para limpar filtros.
   - Evitar que filtros persistidos como “Minhas”, “Todos os quadros”, status, pasta ou serviço deixem a tela aparentemente sem demandas sem explicação.

3. **Corrigir o modo “Todos os quadros”**
   - Garantir que `/demands` consiga buscar todas as demandas acessíveis ao usuário em todos os quadros da equipe/conta sem depender de um quadro atual inválido.
   - Manter o comportamento já pedido anteriormente: combinar “Todos os quadros” com “Minhas” para ver apenas demandas atribuídas ao usuário.

4. **Adicionar estados de diagnóstico úteis ao usuário**
   - Diferenciar visualmente:
     - sem demandas reais;
     - sem quadro selecionado;
     - filtros sem resultado;
     - carregamento/erro de permissão.
   - Incluir botão “Limpar filtros” quando houver filtros ativos.

5. **Validar**
   - Rodar a tela com sessão autenticada quando disponível.
   - Confirmar que a conta consegue ver demandas ao entrar em `/demands`.
   - Confirmar que “Todos os quadros” e “Minhas” funcionam sem deixar a tela vazia indevidamente.