/**
 * generate-release-notes
 *
 * Gera automaticamente as notas de atualização (patch notes) de uma publicação
 * e as injeta no pipeline de anúncios já existente.
 *
 * Fluxo: commits da build em produção -> Lovable AI (texto em pt-BR) ->
 *        manifest de release -> ingest-release-event (autoApprove) ->
 *        release_deliveries (canal inapp) -> notificações internas.
 *
 * Chamada por `detect-production-release` quando a build publicada não traz um
 * `release-manifest.json` escrito à mão. Nunca envia e-mail.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  selectAnnounceableChanges,
  parseGeneratedNotes,
  notesToReleaseFeatures,
  buildPatchNotesPrompt,
  PATCH_NOTES_SYSTEM_PROMPT,
  type BuildChange,
} from "../_shared/autoReleaseNotes.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RELEASE_EVENT_SECRET = Deno.env.get("RELEASE_EVENT_SECRET") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const MODEL = "google/gemini-3.8-flash";

function log(level: "info" | "warn" | "error", message: string, ctx: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    fn: "generate-release-notes",
    level,
    message,
    ts: new Date().toISOString(),
    ...ctx,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** service role, segredo de release, token do cron ou admin global autenticado. */
async function isAuthorized(req: Request): Promise<boolean> {
  const secret = req.headers.get("x-release-secret") ?? "";
  if (RELEASE_EVENT_SECRET && secret && safeEqual(secret, RELEASE_EVENT_SECRET)) return true;

  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  if (!bearer) return false;
  if (SERVICE_ROLE_KEY && safeEqual(bearer, SERVICE_ROLE_KEY)) return true;

  const { data: cronToken } = await supabase.rpc("get_release_detection_cron_token");
  if (typeof cronToken === "string" && cronToken && safeEqual(bearer, cronToken)) return true;



  const { data: userData } = await supabase.auth.getUser(bearer);
  const userId = userData?.user?.id;
  if (!userId) return false;
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return isAdmin === true;
}

/** Último commit já anunciado, para não repetir mudanças antigas. */
async function lastAnnouncedSha(): Promise<string | null> {
  const { data } = await supabase
    .from("platform_releases")
    .select("commit_sha, created_at")
    .not("commit_sha", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.commit_sha as string | undefined) ?? null;
}

async function callAi(prompt: string): Promise<{ ok: true; content: string } | { ok: false; status: number; error: string }> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: PATCH_NOTES_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text.slice(0, 500) };
  }
  const payload = await res.json().catch(() => null);
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    return { ok: false, status: 502, error: "resposta da IA sem conteúdo" };
  }
  return { ok: true, content };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!(await isAuthorized(req))) {
    log("warn", "unauthorized generation attempt");
    return json({ error: "Unauthorized" }, 401);
  }

  if (!LOVABLE_API_KEY) {
    log("error", "missing LOVABLE_API_KEY");
    return json({ error: "AI não configurada" }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const releaseKey = typeof body.releaseKey === "string" ? body.releaseKey.trim() : "";
  if (!releaseKey || releaseKey.length > 200) {
    return json({ error: "releaseKey é obrigatório" }, 400);
  }
  const rawChanges = Array.isArray(body.changes) ? (body.changes as BuildChange[]) : [];
  const dryRun = body.dryRun === true;

  const changes = selectAnnounceableChanges(rawChanges, await lastAnnouncedSha());
  if (changes.length === 0) {
    log("info", "no announceable changes", { releaseKey });
    return json({ generated: false, reason: "no_changes", releaseKey });
  }

  const ai = await callAi(buildPatchNotesPrompt(changes));
  if (!ai.ok) {
    log("error", "ai call failed", { releaseKey, status: ai.status, error: ai.error });
    // 429/5xx são transitórios: o próximo ciclo do cron tenta de novo.
    return json({ generated: false, reason: "ai_error", status: ai.status, error: ai.error }, 200);
  }

  const notes = parseGeneratedNotes(ai.content);
  if (notes.length === 0) {
    log("info", "ai returned no user-facing notes", { releaseKey });
    return json({ generated: false, reason: "no_notes", releaseKey });
  }

  const manifest = { version: 1, features: notesToReleaseFeatures(notes, releaseKey) };
  if (dryRun) return json({ generated: true, dryRun: true, notes, manifest });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  };
  if (RELEASE_EVENT_SECRET) headers["X-Release-Secret"] = RELEASE_EVENT_SECRET;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/ingest-release-event`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      eventType: "deployment.published",
      releaseKey,
      deploymentId: typeof body.deploymentId === "string" ? body.deploymentId : undefined,
      commitSha: typeof body.commitSha === "string" ? body.commitSha : undefined,
      publishedAt: typeof body.publishedAt === "string" ? body.publishedAt : undefined,
      autoApprove: true,
      manifest,
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    log("error", "ingest failed", { releaseKey, status: res.status, payload });
    return json({ generated: true, ingested: false, reason: "ingest_failed", status: res.status, payload }, 200);
  }

  // Anúncio aprovado automaticamente: dispara o processador para que as
  // notificações internas saiam sem depender de aprovação manual.
  let processed: unknown = null;
  try {
    const procRes = await fetch(`${SUPABASE_URL}/functions/v1/process-platform-events`, {
      method: "POST",
      headers,
      body: JSON.stringify({ eventId: (payload as Record<string, unknown>).eventId }),
    });
    processed = await procRes.json().catch(() => ({}));
    if (!procRes.ok) log("warn", "processor returned error", { releaseKey, status: procRes.status, processed });
  } catch (error) {
    // Falha aqui não perde o anúncio: o evento segue pendente no outbox.
    log("warn", "processor call failed", { releaseKey, error: (error as Error).message });
  }

  log("info", "patch notes announced", { releaseKey, notes: notes.length });

  return json({ generated: true, ingested: true, releaseKey, notes, processed, ...(payload as Record<string, unknown>) });
});
