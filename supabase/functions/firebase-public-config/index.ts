const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const PUBLIC_FIREBASE_FIELDS = {
  apiKey: "FIREBASE_API_KEY",
  authDomain: "FIREBASE_AUTH_DOMAIN",
  projectId: "FIREBASE_PROJECT_ID",
  storageBucket: "FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "FIREBASE_MESSAGING_SENDER_ID",
  appId: "FIREBASE_APP_ID",
  vapidKey: "FIREBASE_VAPID_KEY",
} as const;

type PublicFirebaseField = keyof typeof PUBLIC_FIREBASE_FIELDS;

function readServiceAccountDiagnostics(configProjectId: string): {
  serviceAccountProjectConfigured: boolean;
  serviceAccountProjectMatchesConfig: boolean | null;
} {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT")?.trim();
  if (!raw) {
    return {
      serviceAccountProjectConfigured: false,
      serviceAccountProjectMatchesConfig: null,
    };
  }

  try {
    const parsed = JSON.parse(raw) as { project_id?: unknown };
    const serviceAccountProjectId =
      typeof parsed.project_id === "string" ? parsed.project_id.trim() : "";
    return {
      serviceAccountProjectConfigured: serviceAccountProjectId.length > 0,
      serviceAccountProjectMatchesConfig: serviceAccountProjectId
        ? serviceAccountProjectId === configProjectId
        : null,
    };
  } catch {
    return {
      serviceAccountProjectConfigured: false,
      serviceAccountProjectMatchesConfig: null,
    };
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const config: Partial<Record<PublicFirebaseField, string>> = {};
  const missing: string[] = [];

  for (const [field, envName] of Object.entries(PUBLIC_FIREBASE_FIELDS) as Array<
    [PublicFirebaseField, (typeof PUBLIC_FIREBASE_FIELDS)[PublicFirebaseField]]
  >) {
    const value = Deno.env.get(envName)?.trim();
    if (!value) {
      missing.push(envName);
      continue;
    }
    config[field] = value;
  }

  if (missing.length > 0) {
    console.error("[firebase-public-config] incomplete public Firebase config", {
      missing,
    });
    return jsonResponse(
      {
        error: "firebase_public_config_incomplete",
        missing,
      },
      503,
    );
  }

  // Every value returned here is part of the Firebase Web App public config.
  // Service account JSON, private keys and cron credentials are never exposed.
  return jsonResponse({
    ...config,
    diagnostics: readServiceAccountDiagnostics(config.projectId ?? ""),
  });
});
