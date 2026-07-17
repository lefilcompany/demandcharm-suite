import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(200),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: "validation_error", details: parsed.error.flatten().fieldErrors }, 400);
  }
  const { email, password } = parsed.data;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "server_misconfigured" }, 500);

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const status = error.status ?? 401;
    const code = error.message?.toLowerCase().includes("email not confirmed")
      ? "email_not_confirmed"
      : status === 429 ? "rate_limited" : "invalid_credentials";
    return json({ error: code, message: "Não foi possível autenticar. Verifique email e senha." }, status === 429 ? 429 : 401);
  }

  if (!data?.session) return json({ error: "no_session" }, 500);

  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    token_type: data.session.token_type,
    user: {
      id: data.user?.id,
      email: data.user?.email,
    },
  });
});
