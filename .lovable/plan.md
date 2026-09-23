# Deixar o sistema mais rápido e limpar avisos antigos

Três ajustes no banco. Verifiquei cada ponto antes de escrever este plano.

## 1. Corrigir a regra de acesso aos perfis (maior ganho)

Hoje existe uma regra de visibilidade de perfis criada para visitantes de links públicos que, por engano, também é aplicada a todo usuário logado. Resultado: qualquer tela que mostra nomes e fotos faz uma varredura pesada em todas as demandas — cerca de 500 ms para apenas 105 perfis.

Correção: essa regra passa a valer apenas para visitantes anônimos. Usuários logados continuam vendo os perfis de quem está nas mesmas equipes e quadros, exatamente como hoje. Links públicos de demanda continuam mostrando os nomes normalmente.

## 2. Índice para a listagem do Kanban

Já verifiquei: o índice sugerido (`idx_demands_board_archived_updated`) **já existe** no banco. Nada a fazer aqui. Se ainda houver lentidão na listagem, ela vem das regras de acesso (item 1), não de falta de índice.

## 3. Limpeza automática de avisos antigos

Hoje são 68.007 avisos guardados, dos quais 8.671 já foram lidos há mais de 60 dias. Vou criar uma limpeza diária que apaga apenas avisos **já lidos** com mais de 60 dias. Avisos não lidos nunca são apagados.

## Detalhes técnicos

Migração:
- `DROP POLICY "Anonymous can view profiles for shared demands" ON public.profiles;` e recriação idêntica com `TO anon` (a condição `qual` permanece a mesma: criadores/assignees/interações de demandas compartilhadas + criadores de notas compartilhadas). A política redundante `Anonymous can view profiles for shared notes` (já `TO anon`) fica como está.
- Função `public.purge_old_read_notifications()` SECURITY DEFINER, `search_path = public`: `DELETE FROM public.notifications WHERE read = true AND created_at < now() - interval '60 days'`.

Agendamento (via SQL de dados, fora da migração):
- `cron.schedule('purge-old-notifications-daily', '15 4 * * *', $$ SELECT public.purge_old_read_notifications(); $$)` — 1x por dia, alinhado aos jobs diários já existentes (`purge-trashed-demands-daily` às 3:30).

Validação:
- `EXPLAIN ANALYZE` de um `SELECT` em `profiles` como usuário autenticado, antes/depois.
- Contagem de linhas em `notifications` após a primeira execução manual da função.
