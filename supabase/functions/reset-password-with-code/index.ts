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

  try {
    const { email, code, newPassword } = await req.json();
    if (!email || !code || !newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return new Response(JSON.stringify({ error: "invalid input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const normalized = String(email).trim().toLowerCase();
    const codeHash = await sha256Hex(String(code).trim());

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row } = await supabase
      .from("password_reset_codes")
      .select("id, code_hash, expires_at, used")
      .eq("email", normalized)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row || row.code_hash !== codeHash || new Date(row.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Código inválido ou expirado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find user
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = list?.users?.find((u) => u.email?.toLowerCase() === normalized);
    if (!user) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, { password: newPassword });
    if (updErr) throw updErr;

    await supabase.from("password_reset_codes").update({ used: true }).eq("id", row.id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
