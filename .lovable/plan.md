## Diagnóstico encontrado

O publish começou a falhar após a mudança de “pastas” para “projetos” porque há uma divergência real entre Test e Live:

- No ambiente Test, as tabelas já foram renomeadas para `projects`, `project_demands` e `project_shares`.
- No ambiente Live, ainda existem `demand_folders`, `demand_folder_items` e `demand_folder_shares`.
- O código atual já consulta `projects`, então se o frontend for publicado antes da migração aplicar corretamente em Live, a tela de projetos/demandas pode quebrar.
- Também há risco de publish instável por dependências com `engines.node >=20` (`react-router-dom@7.12.0`, `@supabase/supabase-js@2.86.0` via pacote instalado, e `firebase@12.x`), enquanto ambientes de publish podem ser mais restritos.
- A rota/listagem de projetos ainda navega para `/folders/:id`, mantendo rota legada e aumentando chance de inconsistência.

## Plano de correção

1. **Tornar a migração de projetos segura para Live**
   - Substituir a migração de rename por uma versão idempotente/defensiva, que só renomeia quando as tabelas antigas existem e as novas ainda não existem.
   - Garantir que políticas, funções e grants sejam recriados sem depender de um estado específico.
   - Isso evita falha de publish por migração parcialmente aplicada ou divergente entre Test e Live.

2. **Alinhar frontend para a rota nova**
   - Ajustar `Projects.tsx` para abrir `/projects/:id` em vez de `/folders/:id`.
   - Manter `/folders/:folderId` temporariamente como compatibilidade, mas não usar mais na navegação principal.

3. **Reduzir risco de publish por engine Node**
   - Fixar dependências críticas em versões compatíveis com Node 18 quando possível:
     - voltar `react-router-dom` para série 6.x compatível com React Router v6 usado pelo app;
     - avaliar downgrade controlado de Firebase se o app realmente usa messaging/push;
     - não atualizar pacotes automaticamente para versões `>=20`.
   - Atualizar `bun.lock` junto com `package.json`.

4. **Validar sem depender só da preview**
   - Rodar checagens direcionadas permitidas pelo harness: testes unitários relevantes e inspeções de logs/preview.
   - Conferir novamente que Test e Live ficam com o mesmo schema esperado após a migração ser aprovada/publicada.

5. **Se ainda houver erro de publish**
   - Coletar o erro exato do publish/deploy e atacar o próximo bloqueador, mas sem refazer mudanças às cegas.