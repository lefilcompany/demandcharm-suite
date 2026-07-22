import React from "npm:react@18.3.1";
import { render } from "npm:@react-email/render@0.0.12";
import { createClient } from "npm:@supabase/supabase-js@2.110.7";
import { NotificationEmail } from "./_templates/notification.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const RESEND_GATEWAY_URL = "https://connector-gateway.lovable.dev/resend/emails";
const DEFAULT_FROM = "SoMA+ <noreply@pla.soma.lefil.com.br>";

type Scenario = "creation" | "deadline" | "generic";

const SCENARIOS: Record<Scenario, { subject: string; title: string; message: string; type: "info" | "warning" | "success" }> = {
  creation: {
    subject: "[Teste] Nova demanda criada — SoMA+",
    title: "Nova demanda criada",
    message: "Este é um e-mail de teste simulando a notificação enviada quando uma nova demanda é criada no seu quadro.",
    type: "info",
  },
  deadline: {
    subject: "[Teste] Demanda próxima do vencimento — SoMA+",
    title: "Demanda próxima do vencimento",
    message: "Este é um e-mail de teste simulando o lembrete enviado quando uma demanda está prestes a vencer.",
    type: "warning",
  },
  generic: {
    subject: "[Teste] Verificação de envio — SoMA+",
    title: "Teste de envio de e-mail",
    message: "Se você recebeu esta mensagem, o envio de notificações do SoMA+ está funcionando corretamente.",
    type: "success",
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin0 = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await admin0.auth.getUser(token);
    const userId = userData?.user?.id;
    if (userError || !userId) {
      return json({ error: "Unauthorized", details: userError?.message }, 401);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const scenario: Scenario = (["creation", "deadline", "generic"] as const).includes(body?.scenario)
      ? body.scenario
      : "generic";
    const recipientEmail: string | undefined = typeof body?.to === "string" ? body.to.trim() : undefined;

    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return json({ error: "E-mail de destino inválido" }, 400);
    }

    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      await logResult(admin, {
        userId,
        recipientEmail,
        scenario,
        subject: SCENARIOS[scenario].subject,
        status: "rejected",
        errorMessage: "Missing LOVABLE_API_KEY or RESEND_API_KEY",
      });
      return json({ error: "Configuração de e-mail ausente no servidor" }, 500);
    }

    const cfg = SCENARIOS[scenario];
    const html = await render(
      React.createElement(NotificationEmail, {
        title: cfg.title,
        message: cfg.message,
        actionUrl: `${SUPABASE_URL.replace(/\/$/, "")}`,
        actionText: "Abrir SoMA+",
        userName: "Administrador",
        type: cfg.type,
      }),
    );

    const res = await fetch(RESEND_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: DEFAULT_FROM,
        to: [recipientEmail],
        subject: cfg.subject,
        html,
      }),
    });

    const raw = await res.json().catch(() => ({}));
    const accepted = res.ok;

    const logRow = await logResult(admin, {
      userId,
      recipientEmail,
      scenario,
      subject: cfg.subject,
      status: accepted ? "accepted" : "rejected",
      providerMessageId: raw?.id ?? null,
      httpStatus: res.status,
      errorMessage: accepted ? null : raw?.message || raw?.error || `HTTP ${res.status}`,
      raw,
    });

    return json({
      success: accepted,
      status: accepted ? "accepted" : "rejected",
      http_status: res.status,
      provider_message_id: raw?.id ?? null,
      error_message: accepted ? null : raw?.message || raw?.error || `HTTP ${res.status}`,
      log_id: logRow?.id ?? null,
    }, accepted ? 200 : res.status || 500);
  } catch (err) {
    console.error("send-test-email error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

async function logResult(admin: ReturnType<typeof createClient>, params: {
  userId: string;
  recipientEmail: string;
  scenario: string;
  subject: string;
  status: "accepted" | "rejected";
  providerMessageId?: string | null;
  httpStatus?: number;
  errorMessage?: string | null;
  raw?: unknown;
}) {
  const { data, error } = await admin
    .from("test_email_log")
    .insert({
      triggered_by: params.userId,
      recipient_email: params.recipientEmail,
      scenario: params.scenario,
      subject: params.subject,
      status: params.status,
      provider_message_id: params.providerMessageId ?? null,
      http_status: params.httpStatus ?? null,
      error_message: params.errorMessage ?? null,
      raw_response: params.raw ?? null,
    })
    .select("id")
    .single();
  if (error) console.error("Failed to log test email:", error);
  return data;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
