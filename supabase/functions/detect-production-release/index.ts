/**
 * detect-production-release
 *
 * Detecta uma PUBLICAÇÃO REAL em produção e dispara `ingest-release-event`.
 *
 * O ambiente Lovable não expõe (hoje) um webhook/hook pós-deploy oficial. O
 * mecanismo mais confiável disponível é observar o artefato realmente servido
 * pelo domínio de produção: o build gera `/build-info.json` (fingerprint
 * determinístico dos assets) e `/release-manifest.json`. Enquanto a nova versão
 * não estiver de fato no ar, o domínio continua servindo o build antigo — ou
 * seja, commit/push/salvamento NUNCA disparam o evento.
 *
 * Fluxo: cron -> fetch build-info em produção -> buildId novo? ->
 *        POST ingest-release-event (X-Release-Secret) -> outbox -> processor.
 *
 * Falha no ingest não invalida o deploy: é registrada e o próximo ciclo do cron
 * tenta novamente (retry independente).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { validateReleaseManifest, formatManifestIssues } from "../_shared/releaseManifest.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RELEASE_EVENT_SECRET = Deno.env.get("RELEASE_EVENT_SECRET") ?? "";
const DEFAULT_PROD_URL = "https://pla.soma.lefil.com.br";

function log(level: "info" | "warn" | "error", message: string, ctx: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    fn: "detect-production-release",
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

/** service role, cron token (vault) ou admin global autenticado. */
async function isAuthorized(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";

  if (SERVICE_ROLE_KEY && bearer && safeEqual(bearer, SERVICE_ROLE_KEY)) return true;

  if (bearer) {
    const { data: cronToken } = await supabase.rpc("get_release_detection_cron_token");
    if (typeof cronToken === "string" && cronToken && safeEqual(bearer, cronToken)) return true;

    // Admin global chamando manualmente pelo painel.
    const { data: userData } = await supabase.auth.getUser(bearer);
    const userId = userData?.user?.id;
    if (userId) {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (isAdmin === true) return true;
    }
  }

  return false;
}

async function fetchJson(url: string): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, data: await res.json() };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

async function record(entry: Record<string, unknown>) {
  const { error } = await supabase.from("release_detection_log").insert(entry);
  if (error) log("warn", "failed to write detection log", { error: error.message });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!(await isAuthorized(req))) {
    log("warn", "unauthorized detection attempt");
    return json({ error: "Unauthorized" }, 401);
  }

  const prodUrl = (Deno.env.get("APP_URL") || DEFAULT_PROD_URL).replace(/\/+$/, "");
  const bust = Date.now();

  // 1) Ler o artefato REALMENTE servido em produção.
  const buildInfoResult = await fetchJson(`${prodUrl}/build-info.json?t=${bust}`);
  if (!buildInfoResult.ok) {
    log("warn", "build-info unavailable", { prodUrl, error: buildInfoResult.error });
    await record({ status: "failed", prod_url: prodUrl, error: `build-info: ${buildInfoResult.error}` });
    return json({ detected: false, reason: "build_info_unavailable", error: buildInfoResult.error }, 200);
  }

  const buildInfo = buildInfoResult.data as Record<string, unknown>;
  const buildId = typeof buildInfo.buildId === "string" ? buildInfo.buildId : "";
  if (!buildId) {
    await record({ status: "failed", prod_url: prodUrl, error: "build-info sem buildId" });
    return json({ detected: false, reason: "invalid_build_info" }, 200);
  }

  const releaseKey = `build-${buildId}`;
  const commitSha = typeof buildInfo.commitSha === "string" ? buildInfo.commitSha : undefined;
  const publishedAt =
    typeof buildInfo.builtAt === "string" && !Number.isNaN(Date.parse(buildInfo.builtAt))
      ? new Date(buildInfo.builtAt).toISOString()
      : new Date().toISOString();

  // 2) Já ingerido? (idempotência antes mesmo da chamada HTTP)
  const { data: existing, error: existingError } = await supabase
    .from("platform_releases")
    .select("id")
    .eq("release_key", releaseKey)
    .maybeSingle();

  if (existingError) {
    log("error", "failed to look up release", { releaseKey, error: existingError.message });
    return json({ error: "Failed to look up release" }, 500);
  }
  if (existing) {
    return json({ detected: false, reason: "already_ingested", releaseKey, releaseId: existing.id });
  }

  // 3) Manifest servido pela MESMA build em produção.
  const manifestResult = await fetchJson(`${prodUrl}/release-manifest.json?t=${bust}`);
  if (!manifestResult.ok) {
    await record({
      status: "failed",
      prod_url: prodUrl,
      release_key: releaseKey,
      error: `manifest: ${manifestResult.error}`,
    });
    return json({ detected: true, ingested: false, reason: "manifest_unavailable", releaseKey }, 200);
  }

  const validation = validateReleaseManifest(manifestResult.data);
  if (!validation.success) {
    const details = formatManifestIssues(validation.issues);
    log("error", "invalid manifest in production", { releaseKey, details });
    await record({ status: "failed", prod_url: prodUrl, release_key: releaseKey, error: `manifest inválido: ${details}` });
    return json({ detected: true, ingested: false, reason: "invalid_manifest", details }, 200);
  }

  if (validation.data.features.length === 0) {
    log("info", "release without features, nothing to announce", { releaseKey });
    await record({ status: "skipped", prod_url: prodUrl, release_key: releaseKey, error: null });
    return json({ detected: true, ingested: false, reason: "no_features", releaseKey });
  }

  // 4) Disparar o evento real (mesma Edge Function do fluxo oficial).
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  };
  if (RELEASE_EVENT_SECRET) headers["X-Release-Secret"] = RELEASE_EVENT_SECRET;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/ingest-release-event`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        eventType: "deployment.published",
        releaseKey,
        deploymentId: typeof buildInfo.deploymentId === "string" ? buildInfo.deploymentId : undefined,
        commitSha,
        publishedAt,
        manifest: validation.data,
      }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      log("error", "ingest failed", { releaseKey, status: res.status, payload });
      await record({
        status: "failed",
        prod_url: prodUrl,
        release_key: releaseKey,
        error: `ingest HTTP ${res.status}: ${JSON.stringify(payload).slice(0, 500)}`,
      });
      // O deploy continua válido — apenas o anúncio será tentado no próximo ciclo.
      return json({ detected: true, ingested: false, reason: "ingest_failed", releaseKey }, 200);
    }

    log("info", "release ingested", { releaseKey, payload });
    await record({
      status: "ingested",
      prod_url: prodUrl,
      release_key: releaseKey,
      release_id: (payload as Record<string, unknown>).releaseId ?? null,
      error: null,
    });

    return json({ detected: true, ingested: true, releaseKey, ...(payload as Record<string, unknown>) });
  } catch (error) {
    const message = (error as Error).message;
    log("error", "ingest request threw", { releaseKey, error: message });
    await record({ status: "failed", prod_url: prodUrl, release_key: releaseKey, error: message });
    return json({ detected: true, ingested: false, reason: "ingest_error", releaseKey }, 200);
  }
});
