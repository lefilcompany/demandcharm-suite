import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { cacheGet, cacheKey, cacheSet, isRedisConfigured } from "../_shared/redisCache.ts";

/**
 * Leitura com cache compartilhado (Upstash Redis) para os dados mais lidos e
 * mais estáveis do produto: serviços do quadro, perfis e etapas do quadro.
 *
 * A autorização continua sendo do usuário: antes de devolver qualquer conteúdo
 * do cache, checamos o acesso do chamador ao recurso pedido usando o token dele
 * (RLS preservada). O cache guarda apenas o conteúdo, nunca a permissão.
 */

const TTL = {
  services: 900,
  profiles: 600,
  board_statuses: 900,
} as const;

type Resource = keyof typeof TTL;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

  let payload: { resource?: string; boardId?: string; userIds?: string[] };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corpo inválido" }, 400);
  }

  const resource = payload.resource as Resource | undefined;
  if (!resource || !(resource in TTL)) {
    return json({ error: "Recurso inválido" }, 400);
  }

  try {
    if (resource === "services" || resource === "board_statuses") {
      const boardId = payload.boardId;
      if (!boardId || !/^[0-9a-f-]{36}$/i.test(boardId)) {
        return json({ error: "boardId inválido" }, 400);
      }

      // Checagem de acesso do chamador (RLS): se não enxerga o quadro, nega.
      const { data: board, error: boardError } = await supabase
        .from("boards")
        .select("id")
        .eq("id", boardId)
        .maybeSingle();

      if (boardError) throw boardError;
      if (!board) return json({ error: "Sem acesso a este quadro" }, 403);

      const key = cacheKey([resource, boardId]);
      const cached = await cacheGet<unknown[]>(key);
      if (cached) return json({ data: cached, cached: true });

      const data = resource === "services"
        ? await fetchBoardServices(supabase, boardId)
        : await fetchBoardStatuses(supabase, boardId);

      await cacheSet(key, data, TTL[resource]);
      return json({ data, cached: false });
    }

    // profiles
    const userIds = Array.from(new Set((payload.userIds ?? []).filter(
      (id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id),
    ))).slice(0, 200);

    if (userIds.length === 0) return json({ data: [], cached: false });

    const results: Record<string, unknown> = {};
    const missing: string[] = [];

    for (const id of userIds) {
      const cached = await cacheGet<unknown>(cacheKey(["profile", id]));
      if (cached) results[id] = cached;
      else missing.push(id);
    }

    if (missing.length > 0) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email, job_title")
        .in("id", missing);

      if (error) throw error;

      for (const profile of data ?? []) {
        results[profile.id] = profile;
        await cacheSet(cacheKey(["profile", profile.id]), profile, TTL.profiles);
      }
    }

    return json({
      data: userIds.map((id) => results[id]).filter(Boolean),
      cached: missing.length === 0,
    });
  } catch (error) {
    console.error("[cache-read] erro", error);
    return json({ error: "Falha ao carregar os dados" }, 500);
  }
});

async function fetchBoardServices(supabase: any, boardId: string) {
  const { data, error } = await supabase
    .from("board_services")
    .select(`
      id,
      board_id,
      service_id,
      monthly_limit,
      created_at,
      service:services (
        id,
        name,
        estimated_hours,
        description,
        behavior
      )
    `)
    .eq("board_id", boardId);

  if (error) throw error;
  return data ?? [];
}

async function fetchBoardStatuses(supabase: any, boardId: string) {
  const { data, error } = await supabase
    .from("board_statuses")
    .select(`
      id,
      board_id,
      status_id,
      position,
      is_active,
      created_at,
      adjustment_type,
      visible_to_roles,
      status:demand_statuses(id, name, color, is_system)
    `)
    .eq("board_id", boardId)
    .eq("is_active", true)
    .order("position");

  if (error) throw error;
  return (data ?? []).filter((row: any) => row.status !== null);
}

console.log("[cache-read] redis configurado:", isRedisConfigured());
