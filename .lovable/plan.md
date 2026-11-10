# Perfis de acesso por módulo (estilo Run Run It)

## Ideia central

```text
Equipe  -> define O QUE a pessoa acessa (módulos: Finanças, Projetos, Configurações, Relatórios)
Quadro  -> define O QUE ela FAZ nas demandas (Admin, Coordenador, Agente, Solicitante) — sem mudança
```
Os dois nunca se misturam: ser Admin de quadro não dá acesso a Finanças, e ter perfil "Financeiro" não dá poder em quadro nenhum.

## O que o usuário vai ver

1. **Configurações da equipe → "Perfis de acesso"** (nova seção, só o dono vê)
   - Perfis prontos: **Sem acesso**, **Leitor financeiro**, **Analista financeiro**, **Gestor financeiro**, **Gestor de projetos**.
   - Botão "Novo perfil": nome + grade de permissões por módulo (Finanças: ver, ver custos individuais, lançar, exportar, fechar mês, gerenciar acesso; Projetos: ver, editar; Relatórios: ver).
   - Perfis prontos não podem ser apagados; os personalizados sim (se ninguém estiver usando).
2. **Lista de membros com perfil** (substitui a tela "Quem vê os números da equipe")
   - Cada membro: avatar, nome, papel na equipe e um seletor de perfil.
   - Opção "Escopo": **Todos os projetos** ou **Só estes projetos** (seleção múltipla).
3. **Telas de Finanças** passam a mostrar só os projetos do escopo da pessoa.

4. **Agente interno x externo em toda a plataforma**
   - Cada membro da equipe tem um tipo: **Interno**, **Externo (cliente)** ou **Prestador**. Hoje isso só existe no financeiro; passa a valer para a equipe toda.
   - O dono define o tipo na lista de membros (mesma tela dos perfis).
   - Etiqueta discreta "Externo"/"Prestador" ao lado do nome: lista de membros da equipe e do quadro, seletor de responsáveis, cards do Kanban e detalhe da demanda. Interno não mostra etiqueta.
   - Filtro "Interno / Externo" na lista de membros e no filtro de responsáveis do Kanban.
   - O tipo não muda o que a pessoa faz no quadro (isso continua pelo papel do quadro).

## Regras
- Ninguém ganha perfil automaticamente; dono da equipe e administrador geral concedem.
- O dono não altera o próprio perfil (continua a regra atual).
- Solicitantes de quadro e vínculos "Externo do cliente" nunca podem receber perfis com Finanças (bloqueado no servidor).
- Toda mudança fica no histórico de auditoria.
- **Conversão:** cada pessoa com permissões financeiras hoje recebe o perfil pronto equivalente; se a combinação não bater com nenhum, é criado um perfil personalizado "Perfil migrado — Nome". Escopo inicial: todos os projetos. Ninguém perde nem ganha acesso.

## Detalhes técnicos
- Novas tabelas: `access_profiles` (team_id, name, is_system, permissions text[]), `member_access_profiles` (team_id, user_id, profile_id, all_projects bool), `member_access_project_scope` (assignment_id, project_id). GRANT + RLS com `(select auth.uid())`.
- `has_finance_permission(user, board, perm)` reescrita para ler perfil + escopo (quadro → projetos via `project_boards`); assinatura mantida, então RLS/RPCs atuais continuam funcionando. Nova `has_module_permission(user, team, perm, project?)`.
- RPCs SECURITY DEFINER: `upsert_access_profile`, `delete_access_profile`, `assign_access_profile` (valida dono/admin, self-grant, solicitante/externo), todas auditadas.
- Backfill de `finance_permissions` → perfis; tabela antiga fica marcada como DEPRECATED (não é apagada).
- Frontend: `src/lib/access/profiles.ts` (catálogo de permissões, detecção de perfil pronto) + testes; `AccessProfilesManager.tsx` e `MemberAccessList.tsx` em TeamConfig, substituindo `FinanceAccessManager`; hooks com user id na chave.
- Tipo do membro: nova coluna `member_kind` em `team_members` (padrão `internal`), preenchida a partir do vínculo atual em `finance_member_profiles`; alteração só via RPC `set_member_kind` (dono/admin, auditada). O vínculo financeiro com vigência continua para cálculo de custo e passa a sugerir o valor.
- Hook `useMemberKinds(teamId)` + componente `MemberKindBadge` reutilizado nas telas listadas.
- Testes: regras de conversão, bloqueio de solicitante, escopo por projeto e verificação no banco de que ninguém perdeu acesso após a migração.
- AGENTS.md: substituir a regra de acesso financeiro pela de perfis por módulo.
