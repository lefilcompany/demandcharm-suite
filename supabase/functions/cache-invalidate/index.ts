import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { cacheDelete, cacheKey } from "../_shared/redisCache.ts";

/**
 * Remove do cache compartilhado as cópias de um recurso que acabou de ser
 * alterado (serviço do quadro, etapa do quadro ou perfil).
 */

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

  const uuid = /^[0-9a-f-]{36}$/i;
  const keys: string[] = [];

  if (payload.resource === "services" && payload.boardId && uuid.test(payload.boardId)) {
    keys.push(cacheKey(["services", payload.boardId]));
  }

  if (payload.resource === "board_statuses" && payload.boardId && uuid.test(payload.boardId)) {
    keys.push(cacheKey(["board_statuses", payload.boardId]));
  }

  if (payload.resource === "profiles") {
    const ids = (payload.userIds ?? []).filter((id) => typeof id === "string" && uuid.test(id));
    // Um usuário só pode limpar o próprio perfil ou perfis que ele mesmo informou
    // (a chave guarda apenas dados públicos do perfil; limpar é sempre seguro).
    for (const id of ids.length > 0 ? ids : [userData.user.id]) {
      keys.push(cacheKey(["profile", id]));
    }
  }

  if (keys.length === 0) return json({ error: "Recurso inválido" }, 400);

  await cacheDelete(keys);
  return json({ ok: true, invalidated: keys.length });
});
