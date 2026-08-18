/**
 * test-release-event  (QA ONLY)
 *
 * Dispara uma release SIMULADA usando EXATAMENTE o mesmo pipeline de produção:
 *   ingest-release-event -> platform_events -> process-platform-events
 *   -> resolveFeatureAudience -> release_deliveries -> inapp/email
 *
 * Esta função NÃO duplica nenhuma regra de negócio: ela apenas monta um
 * manifest de teste e chama as Edge Functions existentes por HTTP.
 * A única diferença em relação à produção é a ORIGEM do evento.
 *
 * Acesso: somente administradores globais (public.user_roles / has_role).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function log(level: "info" | "warn" | "error", message: string, ctx: Record<string, unknown> = {}) {
  const line = JSON.stringify({ fn: "test-release-event", level, message, ts: new Date().toISOString(), ...ctx });
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

interface Counts {
  pending: number;
  processing: number;
  sent: number;
  skipped: number;
  failed: number;
  total: number;
}

function emptyCounts(): Counts {
  return { pending: 0, processing: 0, sent: 0, skipped: 0, failed: 0, total: 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const { data: isAdmin, error: roleError } = await admin.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (roleError) {
    log("error", "role check failed", { error: roleError.message });
    return json({ error: "Failed to verify permissions" }, 500);
  }
  if (isAdmin !== true) {
    log("warn", "forbidden test release attempt", { userId: user.id });
    return json({ error: "Forbidden" }, 403);
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    body = {};
  }

  const teamId = typeof body.teamId === "string" && body.teamId ? body.teamId : null;
  const boardId = typeof body.boardId === "string" && body.boardId ? body.boardId : null;

  // Validate the referenced entities exist (QA safety, not business logic).
  if (teamId) {
    const { data: team } = await admin.from("teams").select("id").eq("id", teamId).maybeSingle();
    if (!team) return json({ error: "Equipe informada não existe" }, 400);
  }
  if (boardId) {
    const { data: board } = await admin.from("boards").select("id").eq("id", boardId).maybeSingle();
    if (!board) return json({ error: "Quadro informado não existe" }, 400);
  }

  const stamp = Date.now();
  const releaseKey = `test-release-${stamp}`;

  const features: Record<string, unknown>[] = [
    // FEATURE A - exclusiva para admins globais
    {
      announcementKey: `test-admin-feature-${stamp}`,
      featureKey: "test-admin-feature",
      title: "Teste - Feature exclusiva para admins",
      summary: "Release simulada de QA visível apenas para administradores globais.",
      emailBody:
        "Este é um e-mail de teste do pipeline de novidades da plataforma. Somente administradores globais recebem esta feature.",
      ctaPath: "/admin/release-test",
      ctaLabel: "Abrir teste de release",
      priority: "high",
      audience: { scope: "global", globalRoles: ["admin"], teamRoles: [], boardRoles: [], teamId: null, boardId: null },
      channels: { email: true, inapp: true },
    },
    // FEATURE B - melhoria geral (baixa prioridade, apenas in-app)
    {
      announcementKey: `test-general-improvement-${stamp}`,
      featureKey: "test-general-improvement",
      title: "Teste - Melhoria geral",
      summary: "Release simulada de QA de baixa prioridade (não deve gerar e-mail).",
      priority: "low",
      audience: boardId
        ? { scope: "board", globalRoles: [], teamRoles: [], boardRoles: [], teamId: null, boardId }
        : { scope: "global", globalRoles: [], teamRoles: [], boardRoles: [], teamId: null, boardId: null },
      channels: { email: false, inapp: true },
    },
  ];

  // FEATURE C - equipe específica (somente quando o admin escolhe uma equipe)
  if (teamId) {
    features.push({
      announcementKey: `test-team-feature-${stamp}`,
      featureKey: "test-team-feature",
      title: "Teste - Feature de equipe",
      summary: "Release simulada de QA entregue apenas aos membros da equipe selecionada.",
      emailBody: "Este é um e-mail de teste enviado apenas para membros da equipe selecionada.",
      ctaPath: "/dashboard",
      ctaLabel: "Ir para o painel",
      priority: "normal",
      audience: { scope: "team", globalRoles: [], teamRoles: [], boardRoles: [], teamId, boardId: null },
      channels: { email: true, inapp: true },
    });
  }

  const manifest = { version: 1, features };

  // ---- 1. INGEST (mesma função de produção) ----
  const ingestResponse = await fetch(`${SUPABASE_URL}/functions/v1/ingest-release-event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      eventType: "deployment.published",
      releaseKey,
      deploymentId: `qa-${stamp}`,
      publishedAt: new Date().toISOString(),
      manifest,
    }),
  });
  const ingestResult = await ingestResponse.json().catch(() => ({}));
  if (!ingestResponse.ok) {
    log("error", "ingest failed", { status: ingestResponse.status, ingestResult });
    return json({ error: "Falha ao registrar o evento de release", details: ingestResult }, 502);
  }

  const releaseId: string | null = ingestResult.releaseId ?? null;
  const eventId: string | null = ingestResult.eventId ?? null;

  // ---- 2. PROCESSAR EVENTO (mesma função de produção) ----
  const processResponse = await fetch(`${SUPABASE_URL}/functions/v1/process-platform-events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify(eventId ? { eventId } : {}),
  });
  const processResult = await processResponse.json().catch(() => ({}));

  // ---- 3. RELATÓRIO ----
  const { data: release } = await admin
    .from("platform_releases")
    .select("id, release_key, status, published_at, created_at")
    .eq("id", releaseId ?? "")
    .maybeSingle();

  const { data: featureRows } = await admin
    .from("release_features")
    .select("id, announcement_key, title, priority, audience_scope, email_enabled, inapp_enabled, status")
    .eq("release_id", releaseId ?? "");

  const featureIds = (featureRows ?? []).map((f) => f.id as string);
  const { data: deliveries } = featureIds.length
    ? await admin
        .from("release_deliveries")
        .select("feature_id, user_id, channel, status")
        .in("feature_id", featureIds)
    : { data: [] as Array<Record<string, unknown>> };

  const emailTotals = emptyCounts();
  const inappTotals = emptyCounts();
  const perFeature = new Map<string, { email: Counts; inapp: Counts; audience: Set<string> }>();

  for (const row of (deliveries ?? []) as Array<Record<string, string>>) {
    const bucket =
      perFeature.get(row.feature_id) ??
      { email: emptyCounts(), inapp: emptyCounts(), audience: new Set<string>() };
    perFeature.set(row.feature_id, bucket);
    bucket.audience.add(row.user_id);

    const target = row.channel === "email" ? bucket.email : bucket.inapp;
    const global = row.channel === "email" ? emailTotals : inappTotals;
    const status = (row.status ?? "pending") as keyof Counts;
    if (status in target) {
      (target[status] as number) += 1;
      (global[status] as number) += 1;
    }
    target.total += 1;
    global.total += 1;
  }

  const featuresReport = (featureRows ?? []).map((f) => {
    const bucket = perFeature.get(f.id as string);
    return {
      id: f.id,
      announcementKey: f.announcement_key,
      title: f.title,
      priority: f.priority,
      audienceScope: f.audience_scope,
      emailEnabled: f.email_enabled,
      inappEnabled: f.inapp_enabled,
      status: f.status,
      audienceSize: bucket ? bucket.audience.size : 0,
      email: bucket?.email ?? emptyCounts(),
      inapp: bucket?.inapp ?? emptyCounts(),
    };
  });

  log("info", "test release executed", {
    releaseId,
    eventId,
    userId: user.id,
    features: featuresReport.length,
    email: emailTotals,
    inapp: inappTotals,
  });

  return json({
    success: true,
    duplicate: ingestResult.duplicate === true,
    release: release ?? { id: releaseId, release_key: releaseKey, status: "unknown" },
    eventId,
    processResult,
    features: featuresReport,
    totals: {
      audience: new Set((deliveries ?? []).map((d: Record<string, unknown>) => d.user_id as string)).size,
      email: emailTotals,
      inapp: inappTotals,
    },
  });
});
