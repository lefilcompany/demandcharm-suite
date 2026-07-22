import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Scenario = "creation" | "deadline" | "mention" | "generic";

const SCENARIOS: Record<Scenario, {
  title: string;
  body: string;
  notificationType: string;
}> = {
  creation: {
    title: "[Teste] Nova demanda criada",
    body: "Push de teste simulando a notificação de criação de demanda no SoMA+.",
    notificationType: "demandUpdates",
  },
  deadline: {
    title: "[Teste] Prazo se aproximando",
    body: "Push de teste simulando o lembrete de vencimento de uma demanda.",
    notificationType: "deadlineReminders",
  },
  mention: {
    title: "[Teste] Você foi mencionado",
    body: "Push de teste simulando uma menção em uma demanda.",
    notificationType: "mentionNotifications",
  },
  generic: {
    title: "[Teste] Verificação de push",
    body: "Se você recebeu esta notificação, o push do SoMA+ está funcionando.",
    notificationType: "demandUpdates",
  },
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const userId = userData?.user?.id;
    if (userError || !userId) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const scenario: Scenario = (["creation", "deadline", "mention", "generic"] as const).includes(body?.scenario)
      ? body.scenario
      : "generic";
    const targetUserId: string = typeof body?.targetUserId === "string" && body.targetUserId
      ? body.targetUserId
      : userId;

    const cfg = SCENARIOS[scenario];
    const cronToken = Deno.env.get("CRON_TOKEN") || Deno.env.get("CRON_SECRET");
    if (!cronToken) {
      return json({ error: "cron_token_missing" }, 500);
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronToken}`,
      },
      body: JSON.stringify({
        userId: targetUserId,
        title: cfg.title,
        body: cfg.body,
        data: { notificationType: cfg.notificationType, type: "test_push" },
      }),
    });

    const raw = await res.json().catch(() => ({} as Record<string, unknown>));
    const sent = Number((raw as { sent?: number }).sent ?? 0);
    const failed = Number((raw as { failed?: number }).failed ?? 0);
    const skipped = Number((raw as { skipped?: number }).skipped ?? 0);
    const accepted = res.ok && sent > 0;
    const errorMessage = !accepted
      ? (typeof (raw as { error?: string }).error === "string"
          ? (raw as { error?: string }).error!
          : failed > 0
            ? `FCM failed (${failed})`
            : skipped > 0
              ? "Nenhum dispositivo elegível (preferências desabilitadas ou sem token)"
              : "Nenhum token FCM cadastrado para o usuário")
      : null;

    const { data: logRow } = await admin
      .from("test_push_log")
      .insert({
        triggered_by: userId,
        target_user_id: targetUserId,
        scenario,
        title: cfg.title,
        body: cfg.body,
        status: accepted ? "accepted" : "rejected",
        sent,
        failed,
        skipped,
        http_status: res.status,
        error_message: errorMessage,
        raw_response: raw,
      })
      .select("id")
      .single();

    return json({
      success: accepted,
      status: accepted ? "accepted" : "rejected",
      sent,
      failed,
      skipped,
      http_status: res.status,
      error_message: errorMessage,
      log_id: logRow?.id ?? null,
    });
  } catch (err) {
    console.error("send-test-push error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
