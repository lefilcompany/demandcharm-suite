# Pendências: etiqueta interno/externo e bloqueio de Projetos e Relatórios

## 1. Etiqueta Externo/Prestador em mais lugares
- **Cartões do Kanban:** etiqueta pequena ao lado do avatar ou nome do responsável quando ele for externo ou prestador.
- **Detalhe da demanda:** ao lado do nome do responsável e dos acompanhantes.
- **Membros do quadro:** ao lado do nome, junto do papel no quadro.
- Interno continua sem etiqueta.

## 2. Filtro Interno/Externo no Kanban
- Novo filtro "Responsável: Todos / Internos / Externos" junto dos filtros atuais. Uma demanda aparece em "Externos" se algum responsável for externo ou prestador.
- O atalho `Esc` limpa esse filtro junto com os outros.

## 3. Bloqueio de Projetos e Relatórios (quem não tem perfil perde o acesso)
Sempre podem acessar: dono da equipe e administrador geral. Os demais só acessam com um perfil que inclua a permissão.

| Permissão | Telas bloqueadas |
|---|---|
| Ver projetos | Página Projetos e o detalhe de cada projeto |
| Editar projetos | Criar, renomear, apagar e vincular quadros a projetos |
| Ver relatórios | Dashboard geral, Relatórios, Gestão de tempo/análise por membro, botões de exportar PDF e Excel |

- Os itens do menu lateral somem para quem não tem acesso.
- Ao abrir a tela pelo link, aparece um aviso "Você não tem acesso a esta área. Peça ao dono da equipe." em vez de tela vazia.
- **Página inicial:** quem não tem "Ver relatórios" passa a entrar direto no Kanban, em vez do Dashboard.
- A regra também vale no servidor: os dados de projetos só são entregues para quem tem permissão.
- Pastas pessoais de demandas não são afetadas. Só os projetos da equipe entram no bloqueio.

**Atenção:** como ninguém tem perfil ainda, assim que isso entrar no ar todos os membros, exceto o dono, deixam de ver Projetos, Dashboard e Relatórios até receberem um perfil. Antes de publicar, o dono deve atribuir os perfis (ex.: "Gestor de projetos" para coordenadores).

## Detalhes técnicos
- Hook `useModuleAccess(teamId)`: lê `access_profiles`/`member_access_profiles` do usuário atual mais o papel de dono. A chave de query inclui o user id. Componente `ModuleGate` para as rotas e menu `AppSidebar`.
- Novo perfil pronto opcional: nenhum. Os existentes já incluem `projects.view`/`reports.view`.
- Migração: policies de SELECT/INSERT/UPDATE/DELETE em `projects` (só itens de equipe, nunca pastas pessoais; confirmar a coluna que distingue os dois antes de alterar) passam a exigir `has_module_permission(..., 'projects.view'|'projects.edit', team_id, id)`, mantendo o acesso por compartilhamento existente. Para relatórios, o bloqueio é por tela, porque os dados vêm das mesmas consultas do Kanban.
- `MemberKindBadge` reutilizado em `DemandCard`, no detalhe da demanda e em `BoardMembers`. O tipo vem de um mapa `useMemberKinds(teamId)` (user_id → tipo) a partir de `team_members`.
- Filtro do Kanban em `src/pages/Kanban.tsx`, filtrando pelos responsáveis com o mesmo mapa.
- Testes: função pura de decisão de acesso (dono, admin, com perfil, sem perfil, escopo por projeto) e do filtro interno/externo. No banco: membro sem perfil não lê projetos da equipe, mas lê a pasta pessoal.
- Verificação no navegador: Kanban com etiqueta e filtro, e menu sem Projetos para conta sem perfil.
