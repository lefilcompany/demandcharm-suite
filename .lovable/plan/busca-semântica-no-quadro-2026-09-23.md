# Busca semântica no quadro

Busca que entende o sentido da pergunta ("o que está parado com o Emanuel", "coisas atrasadas de design") e não só palavras exatas. Fica na busca do topo, limitada ao quadro selecionado.

## O que passa a ser encontrado
- Demandas com todo o contexto em texto: título, descrição, etapa, situação (aberta, vencida, entregue no prazo, entregue com atraso), prioridade, responsável e seguidores, serviço, datas e código.
- Solicitações de demanda, com status (aguardando, aprovada, devolvida, recusada).
- Membros do quadro, com papel e cargo.
- Serviços do quadro.

## Como vai funcionar
1. Cada item acima vira um "cartão de texto" guardado no banco junto com uma representação numérica do seu significado.
2. Ao digitar na busca, a frase também é convertida e comparada com esses cartões; volta o que for mais parecido em sentido.
3. A busca por palavra exata continua funcionando e aparece junto, então nada piora se o termo for um código ou um nome.

## Detalhes técnicos
- Migração: extensão `vector`; tabela `search_documents` (`board_id`, `entity_type`, `entity_id`, `title`, `content`, `metadata jsonb`, `embedding vector(768)`, `content_hash`, `updated_at`), índice HNSW cosine, índice único (`board_id`, `entity_type`, `entity_id`), RLS liberando leitura a membros do quadro (`is_board_member`) e escrita só para `service_role`, com os GRANTs correspondentes.
- Função `match_board_documents(p_board_id uuid, p_embedding vector, p_limit int, p_min_similarity float)` SECURITY DEFINER, validando `is_board_member(auth.uid(), p_board_id)` e devolvendo similaridade.
- Edge function `semantic-index` (service role): monta o texto de cada entidade a partir de `board_demand_facts`, `demand_requests`, `board_members`/`profiles` e `services`; pula itens cujo `content_hash` não mudou; gera embeddings em lotes via Gemini (`gemini-embedding-001`, 768 dimensões) com a `GEMINI_API_KEY` já existente; faz upsert e remove documentos órfãos. Aceita `{ boardId, full? }`.
- Edge function `semantic-search` (JWT do usuário): valida acesso ao quadro, gera o embedding da consulta, chama `match_board_documents` e devolve resultados já formatados com link de navegação.
- Reindexação incremental: `semantic-index` é chamada em segundo plano pela `semantic-search` quando o índice do quadro está desatualizado, e por um agendamento diário.
- Frontend: `src/hooks/useSemanticSearch.ts` (debounce ~350 ms, `staleTime` 60s) e `useGlobalSearch` mesclando os dois conjuntos sem duplicar demandas; `GlobalSearchBar` ganha o grupo "Por significado" e novo texto de exemplo no campo.

## Validação
- Indexar o quadro de teste e conferir a quantidade de documentos por tipo.
- Buscar frases sem palavras exatas ("o que está atrasado", "trabalhos do Emanuel") e verificar resultados coerentes.
- Confirmar que outro quadro não aparece e que quem não é membro não recebe resultados.
