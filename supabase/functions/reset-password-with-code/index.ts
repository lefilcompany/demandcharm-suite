import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256Hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { email, code, newPassword } = await req.json();
    if (!email || !code || !newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return json({ ok: false, code: "invalid_input", error: "Dados inválidos" });
    }
    const normalized = String(email).trim().toLowerCase();
    const codeHash = await sha256Hex(String(code).trim());

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error: rowErr } = await supabase
      .from("password_reset_codes")
      .select("id, code_hash, expires_at, used")
      .eq("email", normalized)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rowErr) {
      console.error("lookup code error", rowErr);
      throw rowErr;
    }

    if (!row || row.code_hash !== codeHash || new Date(row.expires_at) < new Date()) {
      return json({ ok: false, code: "invalid_code", error: "Código inválido ou expirado" });
    }

    // Resolve user via SQL helper (avoids listUsers pagination limits)
    const { data: userId, error: lookupErr } = await supabase.rpc("get_user_id_by_email", { _email: normalized });
    if (lookupErr) {
      console.error("user lookup error", lookupErr);
      throw lookupErr;
    }
    if (!userId) {
      return json({ ok: false, code: "user_not_found", error: "Usuário não encontrado" });
    }

    const { error: updErr } = await supabase.auth.admin.updateUserById(userId as string, { password: newPassword });
    if (updErr) {
      console.error("updateUserById error", updErr);

      const authCode = (updErr as { code?: string }).code;
      const reasons = (updErr as { reasons?: string[] }).reasons || [];
      if (authCode === "weak_password" || reasons.includes("pwned")) {
        return json({
          ok: false,
          code: "weak_password",
          error: "Essa senha é muito fraca ou já apareceu em vazamentos. Escolha uma senha mais forte e diferente.",
        });
      }

      if (authCode === "same_password") {
        return json({
          ok: false,
          code: "same_password",
          error: "A nova senha precisa ser diferente da senha atual.",
        });
      }

      throw updErr;
    }

    // Only NOW mark the code as used — never invalidated before a successful password change
    await supabase.from("password_reset_codes").update({ used: true }).eq("id", row.id);

    // Clear the legacy "needs password reset" flag, if any
    try {
      await supabase.rpc("clear_password_reset_required", { _email: normalized });
    } catch (e) {
      console.warn("clear_password_reset_required failed", e);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("reset-password-with-code failed", e);
    return json({ ok: false, code: "internal_error", error: "Não foi possível alterar a senha agora. Tente novamente em instantes." }, 500);
  }
});
