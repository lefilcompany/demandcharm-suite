import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SemanticResult {
  type: "demand" | "request" | "member" | "service";
  id: string;
  title: string;
  snippet: string;
  similarity: number;
  link: string;
  metadata: Record<string, unknown>;
}

function useDebounced(value: string, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * Busca por significado no quadro atual (demandas, solicitações, membros e serviços).
 * Degrada silenciosamente: em caso de falha retorna lista vazia e a busca por palavra continua.
 */
export function useSemanticSearch(query: string, boardId: string | null) {
  const debouncedQuery = useDebounced(query.trim(), 350);
  const enabled = Boolean(boardId) && debouncedQuery.length >= 4;

  return useQuery({
    queryKey: ["semantic-search", debouncedQuery, boardId],
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<SemanticResult[]> => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const { data, error } = await supabase.functions.invoke("semantic-search", {
        body: { boardId, query: debouncedQuery, limit: 8, timezone },
      });
      if (error) {
        console.warn("Busca semântica indisponível", error);
        return [];
      }
      const results = (data as { results?: SemanticResult[] } | null)?.results;
      return Array.isArray(results) ? results : [];
    },
  });
}
