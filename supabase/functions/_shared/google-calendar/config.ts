import { createClient } from "npm:@supabase/supabase-js@2.110.7";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const APP_URL = Deno.env.get("APP_URL") ?? "https://pla.soma.lefil.com.br";

export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Redirect URI must always point at the PROD callback of this project. */
export function callbackUrl() {
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-oauth-callback`;
}

export function googleClient() {
  const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Feature flag: env var wins, DB flag is the fallback source of truth. */
export async function isCalendarEnabled(
  supabase: ReturnType<typeof serviceClient>,
): Promise<boolean> {
  const envFlag = Deno.env.get("GOOGLE_CALENDAR_ENABLED");
  if (envFlag !== undefined && envFlag !== null && envFlag !== "") {
    return envFlag === "true";
  }
  const { data } = await supabase
    .from("app_feature_flags")
    .select("enabled")
    .eq("key", "google_calendar_enabled")
    .maybeSingle();
  return data?.enabled === true;
}

/** Validates the caller's SoMA JWT and returns the user id. */
export async function requireUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data, error } = await authClient.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub as string;
}

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events.owned",
];
