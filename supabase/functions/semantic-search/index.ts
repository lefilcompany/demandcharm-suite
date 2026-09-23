// Busca semântica dentro de um quadro: converte a pergunta em vetor e compara com o índice.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";
import { embedQuery } from "../_shared/geminiEmbeddings.ts";
import { indexBoard } from "../_shared/semanticIndex.ts";

const DEFAULT_TZ = "America/Fortaleza";
const STALE_MS = 10 * 60 * 1000;

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const BodySchema = z.object({
  boardId: z.string().uuid(),
  query: z.string().min(2).max(300),
  limit: z.number().int().min(1).max(30).optional(),
  timezone: z.string().optional(),
});

function linkFor(entityType: string, entityId: string): string {
  switch (entityType) {
    case "demand":
      return `/app/demands/${entityId}`;
    case "request":
      return `/app/demand-requests`;
    case "member":
      return `/app/user/${entityId}`;
    default:
      return `/app/services`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Não autenticado" }, 401);

  let parsed;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    return json({ error: "Corpo inválido" }, 400);
  }
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const { boardId, query, limit, timezone } = parsed.data;
  const tz = timezone || DEFAULT_TZ;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json({ error: "Não autenticado" }, 401);

  const { data: board } = await userClient.from("boards").select("id").eq("id", boardId).maybeSingle();
  if (!board) return json({ error: "Quadro não encontrado ou sem acesso" }, 403);

  const admin = createClient(supabaseUrl, serviceKey);

  // Garante que o índice existe; se estiver velho, atualiza em segundo plano.
  const { data: status } = await userClient.rpc("search_index_status", { p_board_id: boardId });
  const row = Array.isArray(status) ? status[0] : status;
  const count = Number(row?.document_count ?? 0);
  const lastIndexed = row?.last_indexed_at ? new Date(row.last_indexed_at).getTime() : 0;

  try {
    if (count === 0) {
      await indexBoard(admin, boardId, tz);
    } else if (Date.now() - lastIndexed > STALE_MS) {
      const task = indexBoard(admin, boardId, tz).catch((e) => console.error("reindex", e));
      // @ts-ignore EdgeRuntime existe no runtime do Supabase
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(task);
    }
  } catch (error) {
    console.error("semantic-search index", error);
  }

  try {
    const embedding = await embedQuery(query);
    const { data, error } = await userClient.rpc("match_board_documents", {
      p_board_id: boardId,
      p_embedding: JSON.stringify(embedding),
      p_limit: limit ?? 12,
      p_min_similarity: 0.6,
    });
    if (error) throw new Error(error.message);

    const results = (data ?? []).map((r: any) => ({
      type: r.entity_type as string,
      id: r.entity_id as string,
      title: r.title as string,
      snippet: String(r.content ?? "").slice(0, 180),
      metadata: r.metadata ?? {},
      similarity: Number(r.similarity ?? 0),
      link: linkFor(r.entity_type, r.entity_id),
    }));

    return json({ query, results });
  } catch (error) {
    console.error("semantic-search", error);
    return json({ error: error instanceof Error ? error.message : "Falha na busca" }, 500);
  }
});
