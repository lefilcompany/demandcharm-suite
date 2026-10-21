import { createClient } from "npm:@supabase/supabase-js@2";

const enc = new TextEncoder();

async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const unauthorized = () => new Response("Unauthorized", { status: 401 });

Deno.serve(async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("HUB_METRICS_SECRET");
  const ts = req.headers.get("x-hub-timestamp") ?? "";
  const sig = (req.headers.get("x-hub-signature") ?? "").toLowerCase();
  if (!secret || !ts || !Number.isFinite(Number(ts)) || Math.abs(Date.now() - Number(ts)) > 5 * 60_000) return unauthorized();
  if (!safeEqual(sig, await hmacHex(secret, ts))) return unauthorized();

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.rpc("hub_metrics_by_email");
  if (error) return new Response("Internal error", { status: 500 });
  return Response.json({ users: data ?? [] });
});
