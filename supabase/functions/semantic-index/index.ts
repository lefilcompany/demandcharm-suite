// Reindexa o conteúdo pesquisável de um quadro (demandas, solicitações, membros e serviços).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";
import { indexBoard } from "../_shared/semanticIndex.ts";

const DEFAULT_TZ = "America/Fortaleza";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const BodySchema = z.object({
  boardId: z.string().uuid(),
  full: z.boolean().optional(),
  timezone: z.string().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  let parsed;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    return json({ error: "Corpo inválido" }, 400);
  }
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const { boardId, full, timezone } = parsed.data;

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Não autenticado" }, 401);

  const isServiceCall = token === serviceKey;

  if (!isServiceCall) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Não autenticado" }, 401);
    const { data: board } = await userClient.from("boards").select("id").eq("id", boardId).maybeSingle();
    if (!board) return json({ error: "Quadro não encontrado ou sem acesso" }, 403);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const result = await indexBoard(admin, boardId, timezone || DEFAULT_TZ, { full: full === true });
    return json({ boardId, ...result });
  } catch (error) {
    console.error("semantic-index", error);
    return json({ error: error instanceof Error ? error.message : "Falha ao indexar" }, 500);
  }
});
