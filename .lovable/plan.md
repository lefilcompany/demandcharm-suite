# Landing na raiz e sistema em /app

## O que muda para quem usa

- Quem abrir **pla.soma.lefil.com.br** verá a página de apresentação (a landing), não mais o sistema.
- O sistema passa a ficar em **/app** (ex.: /app/demands, /app/kanban, /app/notes).
- Links antigos continuam funcionando: quem clicar num link de e-mail, notificação ou favorito antigo (ex.: /demands/123) é levado automaticamente para o endereço novo (/app/demands/123).
- Login, páginas de política, links compartilhados e a área administrativa continuam nos mesmos endereços.

## Como será feito

1. Colocar a landing na raiz `/` (mantendo `/lp` e `/landing` como atalhos).
2. Mover todas as telas internas do sistema para o prefixo `/app`, com `/app` abrindo a tela inicial.
3. Atualizar todos os links e navegações internas do sistema para o novo prefixo.
4. Criar redirecionamentos automáticos dos endereços antigos para os novos, preservando parâmetros e demais partes do endereço.
5. Ajustar os links gerados em e-mails, notificações e integrações para já apontarem para `/app`.
6. Conferir que login, cadastro, convites, assinatura e administração continuam levando ao lugar certo.

## Detalhes técnicos

- Rotas públicas mantidas fora do prefixo: `/auth`, `/get-started`, `/shared/*`, `/reset-password`, `/privacy-policy`, `/terms-of-service`, `/mcp-docs`, `/admin/*`, `/.lovable/oauth/consent`.
- Rotas movidas para `/app`: index, teams, boards, demands, projects, folders, notes, kanban, reports, profile, settings, pricing, store, time-management, board-summary, team-demands, my-demands, demand-requests, user/:id, welcome, complete-profile, subscription/success, teams/create, teams/join.
- Um componente de redirecionamento (`<LegacyRedirect />`) montado nos caminhos antigos fará `Navigate` com `replace` para `/app` + path + search + hash.
- Links internos (`navigate(...)`, `<Link to=...>`, `href`) serão reescritos com o prefixo; caminhos relativos e âncoras não serão alterados.
- `src/lib/mcp/_shared/urls.ts`, `supabase/functions/mcp/index.ts`, `check-deadlines/lib.ts`, `google-calendar-sync-meeting` e `processReleaseEmailDeliveries` passam a gerar `/app/...`.
- `src/lib/routePrefetch.ts` e atalhos de teclado/CommandMenu serão atualizados junto.
- SEO: a landing assume o canonical da raiz; título e descrição atuais da landing passam a valer para `/`.
