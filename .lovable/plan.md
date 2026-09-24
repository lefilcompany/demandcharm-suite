# Importar demandas a partir de um documento

## O que o usuário verá
1. Na página **Demandas**, novo botão **"Importar de documento"** ao lado de "Nova demanda".
2. Abre um diálogo em 3 passos:
   - **Enviar**: escolher o quadro de destino + arrastar/selecionar arquivo (PDF, DOCX, XLSX, CSV, TXT, MD; até 10 MB).
   - **Revisar**: a IA lê o documento e mostra uma lista editável de demandas encontradas — título, descrição, serviço (do quadro escolhido), prazo, prioridade e responsável. Dá para editar, remover ou adicionar linhas. Linhas com problema (ex.: descrição com menos de 20 caracteres, sem serviço quando obrigatório) ficam destacadas.
   - **Criar**: botão "Criar N demandas"; progresso e resumo ao final (criadas / com erro), com link para o quadro.
3. Respeita permissões e limites do plano/mensais: se o limite for atingido no meio, as restantes aparecem como erro com o motivo.

## Detalhes técnicos
- **Leitura do arquivo no navegador**: planilhas/CSV via `xlsx` (linhas viram demandas, colunas mapeadas por nome: título, descrição, serviço, prazo, prioridade, responsável); DOCX via `mammoth` (texto); TXT/MD direto; PDF enviado em base64.
- **Nova Edge Function `extract-demands-from-document`**: autentica o usuário, confere acesso ao quadro, carrega serviços e membros do quadro, chama Gemini (`gemini-2.5-flash`, segredo `GEMINI_API_KEY` já existente; PDF como inline data) com saída estruturada (schema zod com `.nullish()`), prompt em português. Retorna sugestões com `service_id`/`assignee_id` já casados pelos nomes. Limite de 50 demandas por importação.
- **Criação**: reutiliza o mesmo caminho de criação usado hoje (`useCreateDemand` / validação central em `src/lib/validations.ts`), uma a uma sequencialmente, para que triggers, notificações, limites e cache versionado funcionem igual à criação manual. Status inicial = primeira etapa do quadro (filtrando `board_statuses` por `board_id`). Datas tratadas com `substring(0,10)`.
- **Arquivos**: `src/components/demands/ImportDemandsDialog.tsx` (novo), botão em `src/pages/Demands.tsx`, `supabase/functions/extract-demands-from-document/index.ts` (imports `npm:`).
- Sem mudanças no banco. O arquivo original não é salvo.
