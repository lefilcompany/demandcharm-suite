// Read-only finance contract v1 for the external panel: project x month, amounts in BRL rounded to cents.
// Auth: `Authorization: Bearer sk_fin_...` (team API key with permission finance.read).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "GET") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("sk_fin_")) return json({ error: "UNAUTHORIZED" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: key } = await admin.from("api_keys")
    .select("id, team_id, permissions, is_active, expires_at")
    .eq("key_hash", await sha256Hex(token)).maybeSingle();
  const perms = (key?.permissions ?? {}) as Record<string, boolean>;
  if (!key || !key.is_active || !perms["finance.read"] || (key.expires_at && new Date(key.expires_at) < new Date())) {
    return json({ error: "UNAUTHORIZED" }, 401);
  }

  const url = new URL(req.url);
  const competence = url.searchParams.get("competence") ?? "";
  const cursor = url.searchParams.get("cursor");
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const log = (status: number) =>
    admin.from("api_logs").insert({ api_key_id: key.id, method: "GET", path: `/finance/v1?competence=${competence}`, status_code: status }).then(() => {});

  if (!/^\d{4}-\d{2}$/.test(competence) || (cursor && !UUID.test(cursor))) {
    await log(400);
    return json({ error: "INVALID_PARAMS", hint: "competence=YYYY-MM, cursor=<uuid>, limit=1..200" }, 400);
  }

  const { data, error } = await admin.rpc("finance_api_v1_page", {
    _team_id: key.team_id, _competence: `${competence}-01`, _cursor: cursor, _limit: limit,
  });
  if (error) { await log(500); return json({ error: "INTERNAL" }, 500); }
  await Promise.all([log(200), admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id)]);
  return json(data);
});
