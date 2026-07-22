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
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const normalized = email.trim().toLowerCase();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check user exists via SQL (works with any number of users)
    const { data: userId, error: lookupErr } = await supabase.rpc("get_user_id_by_email", { _email: normalized });
    if (lookupErr) console.error("lookup error", lookupErr);

    if (userId) {
      // Soft rate limit: 1 send per 30s per email (does NOT invalidate previous code)
      const sinceIso = new Date(Date.now() - 30_000).toISOString();
      const { data: recent } = await supabase
        .from("password_reset_codes")
        .select("id")
        .eq("email", normalized)
        .gte("created_at", sinceIso)
        .limit(1);

      if (recent && recent.length > 0) {
        return new Response(JSON.stringify({ ok: true, throttled: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codeHash = await sha256Hex(code);
      // Codes valid for 60 minutes — survive across page refreshes / wrong attempts
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const { error: insertErr } = await supabase.from("password_reset_codes").insert({
        email: normalized,
        code_hash: codeHash,
        expires_at: expiresAt,
      });
      if (insertErr) throw insertErr;

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("Missing LOVABLE_API_KEY");

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1D1D1D;">
          <h2 style="color:#1D1D1D;margin:0 0 16px;">Recuperação de senha</h2>
          <p style="font-size:15px;line-height:1.5;">Use o código abaixo para redefinir sua senha. Ele expira em 60 minutos.</p>
          <div style="margin:24px 0;padding:20px;background:#FFF7EE;border:1px solid #F28705;border-radius:12px;text-align:center;">
            <div style="font-size:34px;font-weight:700;letter-spacing:10px;color:#F28705;font-family:monospace;">
              ${code}
            </div>
          </div>
          <p style="font-size:13px;color:#666;">Se você não solicitou, ignore este e-mail.</p>
          <p style="font-size:13px;color:#666;margin-top:24px;">— Equipe SoMA+</p>
        </div>`;

      const resp = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": RESEND_API_KEY,
        },
        body: JSON.stringify({
          from: "SoMA+ <no-reply@pla.soma.lefil.com.br>",
          to: [normalized],
          subject: `Seu código: ${code}`,
          html,
        }),
      });

      if (!resp.ok) {
        const body = await resp.text();
        console.error("resend gateway error", resp.status, body);
        throw new Error(`Resend gateway failed: ${resp.status}`);
      }
    }

    // Always return ok to prevent email enumeration
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
