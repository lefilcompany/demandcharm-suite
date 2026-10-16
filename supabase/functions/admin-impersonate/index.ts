import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const Body = z.object({ target_user_id: z.string().uuid(), reason: z.string().max(500).optional() });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: caller, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !caller?.user) return json({ error: "Não autenticado" }, 401);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: caller.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Apenas administradores do sistema" }, 403);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Dados inválidos" }, 400);
    const { target_user_id, reason } = parsed.data;
    if (target_user_id === caller.user.id) return json({ error: "Você já está nesta conta" }, 400);

    const { data: targetIsAdmin } = await admin.rpc("has_role", { _user_id: target_user_id, _role: "admin" });
    if (targetIsAdmin) return json({ error: "Não é permitido acessar a conta de outro administrador" }, 403);

    const { data: target, error: tErr } = await admin.auth.admin.getUserById(target_user_id);
    if (tErr || !target?.user?.email) return json({ error: "Usuário não encontrado" }, 404);

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: target.user.email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      console.error("generateLink error", linkErr);
      return json({ error: "Não foi possível gerar o acesso" }, 500);
    }

    const { error: logErr } = await admin.from("admin_impersonation_log").insert({
      admin_id: caller.user.id,
      target_user_id,
      target_email: target.user.email,
      reason: reason ?? null,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: req.headers.get("user-agent"),
    });
    if (logErr) {
      console.error("log error", logErr);
      return json({ error: "Falha ao registrar o acesso" }, 500);
    }

    return json({ token_hash: link.properties.hashed_token, email: target.user.email });
  } catch (e) {
    console.error(e);
    return json({ error: "Erro interno" }, 500);
  }
});
