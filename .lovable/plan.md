# Ficha de desenvolvedor da sprint (PDF)

Transformar o "Baixar resumo" da sprint numa ficha no estilo notas de versão, em PDF, com quatro blocos.

## O que a ficha terá

1. **Cabeçalho da sprint** — nome, quadro, período, situação, objetivo, autor e data de geração.
2. **O que agora é possível** — texto escrito pela IA a partir das demandas entregues na sprint: lista curta de novidades no formato "Agora é possível…", agrupada por serviço. Cada item cita as demandas de origem (#número).
3. **Diffs da sprint** — o que mudou nas demandas durante o período, no estilo changelog:
   - `+ Entrou` / `- Saiu` da sprint
   - `✓ Entregue` (com data e se foi no prazo ou atrasada)
   - `→ Mudou de etapa` (etapa atual e quando mudou)
   - `~ Prazo alterado` (de → para, quem alterou)
   - `↻ Veio da sprint anterior` (carregada ao concluir)
4. **Relatório** — números: total, entregues, pendentes, atrasadas, % concluído, esforço entregue vs planejado, horas registradas, por responsável.
5. **Lista de demandas** — tabela com #, título, serviço, responsável, etapa, prioridade, esforço, prazo, entrega.

O Excel atual continua disponível como está. O diálogo ganha uma prévia do bloco "O que agora é possível" antes de baixar, com botão para gerar de novo.

## Detalhes técnicos

- Primeiro passo: confirmar quais registros de mudança existem (data de entrada na sprint em `sprint_demands`, `demand_due_date_changes`, `status_changed_at`, `delivered_at`, interações de status). O que não tiver histórico aparece só como estado final — sem inventar diffs.
- Nova lib `src/lib/sprintDevSheet.ts`: monta eventos de diff e métricas a partir dos dados da sprint (função pura, com testes em `sprintDevSheet.test.ts`).
- Novo `src/lib/sprintDevSheetPdf.ts`: reaproveita `drawHeader` e o padrão visual de `kanbanSnapshotPdf.ts` (laranja/grafite), com seções de changelog e tabela via autotable.
- Nova Edge `sprint-release-notes`: valida JWT e acesso ao quadro, recebe só os IDs da sprint, busca as entregues no banco e chama o Gemini (mesma chave do resumo do quadro) para gerar os itens "Agora é possível". Sem entregas, devolve vazio e o PDF diz "Nenhuma entrega nesta sprint".
- `SprintSnapshotDialog.tsx`: botão "Ficha da sprint (PDF)" substitui o PDF atual; Excel mantido.
- Se faltar histórico de mudança de etapa, uma migração pequena pode registrar mudanças daqui pra frente (só se o passo 1 mostrar que não existe).
