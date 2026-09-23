import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { cacheGet, cacheKey, cacheSet, isRedisConfigured } from "../_shared/redisCache.ts";

/**
 * Leitura das demandas de um quadro com cache compartilhado (Upstash Redis).
 *
 * O banco continua sendo a fonte da verdade: a chave do cache carrega o número
 * de versão do quadro (`board_cache_versions.demands_version`), que sobe via
 * trigger a cada mudança em demanda, responsável/seguidor ou etapa. Assim que
 * algo muda, a chave antiga deixa de ser consultada — não há janela de dado
 * velho. O TTL curto serve apenas para limpar chaves de versões antigas.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const TTL_SECONDS = 120;
const UUID = /^[0-9a-f-]{36}$/i;

const DEMANDS_SELECT = `
  *,
  demand_statuses(name, color),
  profiles!demands_created_by_fkey(full_name, avatar_url),
  assigned_profile:profiles!demands_assigned_to_fkey(full_name, avatar_url),
  status_changed_by_profile:profiles!demands_status_changed_by_fkey(full_name, avatar_url),
  teams(name),
  services(id, name, estimated_hours),
  boards(id, name),
  demand_assignees(
    user_id,
    is_primary,
    profile:profiles(full_name, avatar_url)
  )
`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Não autenticado" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return json({ error: "Não autenticado" }, 401);
  }

  let payload: { boardId?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corpo inválido" }, 400);
  }

  const boardId = payload.boardId;
  if (!boardId || !UUID.test(boardId)) {
    return json({ error: "boardId inválido" }, 400);
  }

  try {
    // Acesso do chamador (RLS): se não enxerga o quadro, nega.
    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("id")
      .eq("id", boardId)
      .maybeSingle();

    if (boardError) throw boardError;
    if (!board) return json({ error: "Sem acesso a este quadro" }, 403);

    // O que o usuário enxerga pode variar por papel no quadro.
    const { data: role } = await supabase.rpc("get_board_role", {
      _board_id: boardId,
      _user_id: userData.user.id,
    });

    const { data: versionRow } = await supabase
      .from("board_cache_versions")
      .select("demands_version")
      .eq("board_id", boardId)
      .maybeSingle();

    const version = versionRow?.demands_version ?? 0;
    const key = cacheKey(["demands", boardId, String(role ?? "none"), `v${version}`]);

    const cached = await cacheGet<unknown[]>(key);
    if (cached) return json({ data: cached, cached: true, version });

    const { data, error } = await supabase
      .from("demands")
      .select(DEMANDS_SELECT)
      .eq("board_id", boardId)
      .eq("archived", false);

    if (error) throw error;

    const rows = data ?? [];
    await cacheSet(key, rows, TTL_SECONDS);

    return json({ data: rows, cached: false, version });
  } catch (error) {
    console.error("[demands-read] erro", error);
    return json({ error: "Falha ao carregar as demandas" }, 500);
  }
});

console.log("[demands-read] redis configurado:", isRedisConfigured());
