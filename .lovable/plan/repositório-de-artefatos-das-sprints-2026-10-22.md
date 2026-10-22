# Repositório de artefatos das sprints

## O que o usuário vai ver
- Nova aba **Artefatos** no detalhe da sprint e uma página **Artefatos do quadro** (repositório geral com pastas: "Geral do quadro", "Modelos" e uma pasta por sprint).
- Tipos de artefato: **ADR**, **Lista de demandas**, **Modelo**, **Relatório**, **Documentação**, **Outro** — com filtro por tipo e busca por nome.
- Cada artefato pode ser:
  - **Arquivo enviado** (PDF, Word, Excel, imagens, Markdown, até 20 MB), com pré-visualização e download.
  - **Documento escrito no SoMA** (editor de texto do app).
- **ADR híbrida**:
  - "Nova ADR" abre um modelo com Contexto, Decisão, Alternativas consideradas e Consequências.
  - Ou "Enviar ADR" para subir um arquivo pronto.
  - Numeração automática por quadro (ADR-001, ADR-002...), situação (Proposta, Aceita, Substituída, Descartada) e "substituída por" ligando à ADR nova.
  - Pode citar demandas relacionadas (#número), que abrem ao clicar.
- **Modelos do quadro**: qualquer documento pode ser salvo como modelo e reutilizado em sprints futuras ("Criar a partir de modelo"). O modelo de ADR vem pronto e pode ser editado.
- **Ao concluir a sprint**: a Ficha da sprint (PDF) e a lista de demandas (Excel) são gerados e guardados sozinhos na pasta da sprint.
- Mover artefato entre pastas (ex.: de uma sprint para "Geral do quadro").
- Permissões iguais às das sprints: admin, coordenador e agente criam, editam e excluem; solicitante só visualiza e baixa.

## Sugestões sobre a ADR (já incorporadas)
- O modelo escrito no SoMA é o recomendado: fica pesquisável, tem histórico e situação, e liga às demandas.
- O envio de arquivo continua disponível para quem já escreve fora do SoMA.
- Uma ADR aceita não se edita; para mudar a decisão, cria-se uma nova que substitui a anterior. Assim o histórico das decisões fica preservado.

## Detalhes técnicos
- Armazenamento privado `sprint-artifacts` (20 MB por arquivo), caminho `<board_id>/<artifact_id>/<arquivo>`; políticas em storage.objects via `is_board_member` (leitura) e papel do quadro diferente de requester (escrita), sempre com `(select auth.uid())`.
- Tabela `board_artifacts`: board_id, sprint_id (nulo = geral do quadro), kind (adr, demand_list, template, report, doc, other), title, source (upload | authored), file_path/file_name/file_size/mime_type, content (texto do editor), is_template, adr_number, adr_status, superseded_by, related_demand_ids, auto_generated, created_by, timestamps. GRANTs + RLS no mesmo padrão das sprints.
- Trigger: numeração sequencial da ADR por quadro, valida que a sprint é do mesmo quadro e bloqueia edição de conteúdo de ADR "Aceita".
- Download por link assinado em lote (padrão de `useAttachments`); pré-visualização reaproveita `DocumentPreviewDialog`.
- Conclusão da sprint: após `complete_sprint`, o app gera o PDF (`sprintDevSheetPdf`) e o Excel (`snapshotXlsx`) e envia como artefatos `auto_generated`; se falhar, mostra aviso com "Tentar de novo", sem bloquear a conclusão.
- Hooks `useBoardArtifacts(boardId, sprintId?)`, `useUploadArtifact`, `useSaveAuthoredArtifact`, `useDeleteArtifact` (chaves com user id; estado de erro com retry, nunca vazio falso).
- UI: `SprintArtifactsPanel.tsx` (aba na sprint), página `/app/artifacts`, `AdrEditor.tsx`, `ArtifactUploadDialog.tsx`.
- Testes: numeração de ADR, regra "ADR aceita não edita", permissão de solicitante só leitura.
- Registrar a regra do repositório em AGENTS.md.
