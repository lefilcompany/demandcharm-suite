CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.search_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL,
  embedding extensions.vector(768),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS search_documents_unique_entity
  ON public.search_documents (board_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS search_documents_board_idx
  ON public.search_documents (board_id);

CREATE INDEX IF NOT EXISTS search_documents_embedding_idx
  ON public.search_documents
  USING hnsw (embedding extensions.vector_cosine_ops);

GRANT SELECT ON public.search_documents TO authenticated;
GRANT ALL ON public.search_documents TO service_role;

ALTER TABLE public.search_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Board members can read search documents" ON public.search_documents;
CREATE POLICY "Board members can read search documents"
  ON public.search_documents
  FOR SELECT
  TO authenticated
  USING (public.is_board_member(auth.uid(), board_id));

CREATE OR REPLACE FUNCTION public.match_board_documents(
  p_board_id uuid,
  p_embedding extensions.vector,
  p_limit integer DEFAULT 12,
  p_min_similarity double precision DEFAULT 0.3
)
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  title text,
  content text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.is_board_member(auth.uid(), p_board_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    d.entity_type,
    d.entity_id,
    d.title,
    d.content,
    d.metadata,
    (1 - (d.embedding <=> p_embedding))::double precision AS similarity
  FROM public.search_documents d
  WHERE d.board_id = p_board_id
    AND d.embedding IS NOT NULL
    AND (1 - (d.embedding <=> p_embedding)) >= COALESCE(p_min_similarity, 0)
  ORDER BY d.embedding <=> p_embedding
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 12), 50), 1);
END;
$$;

REVOKE ALL ON FUNCTION public.match_board_documents(uuid, extensions.vector, integer, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_board_documents(uuid, extensions.vector, integer, double precision) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.search_index_status(p_board_id uuid)
RETURNS TABLE (document_count bigint, last_indexed_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint, max(d.updated_at)
  FROM public.search_documents d
  WHERE d.board_id = p_board_id
    AND public.is_board_member(auth.uid(), p_board_id);
$$;

GRANT EXECUTE ON FUNCTION public.search_index_status(uuid) TO authenticated, service_role;