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
    const { email, code } = await req.json();
    if (!email || !code || typeof email !== "string" || typeof code !== "string") {
      return new Response(JSON.stringify({ valid: false, error: "invalid input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const normalized = email.trim().toLowerCase();
    const codeHash = await sha256Hex(code.trim());

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row } = await supabase
      .from("password_reset_codes")
      .select("id, code_hash, expires_at, used, attempts")
      .eq("email", normalized)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return new Response(JSON.stringify({ valid: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});
    if (new Date(row.expires_at) < new Date()) {
      return new Response(JSON.stringify({ valid: false, expired: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }
    if (row.attempts >= 5) {
      await supabase.from("password_reset_codes").update({ used: true }).eq("id", row.id);
      return new Response(JSON.stringify({ valid: false, locked: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }
    if (row.code_hash !== codeHash) {
      await supabase.from("password_reset_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return new Response(JSON.stringify({ valid: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

    return new Response(JSON.stringify({ valid: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ valid: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
