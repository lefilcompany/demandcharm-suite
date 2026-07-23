import React from "npm:react@18.3.1";
import { render } from "npm:@react-email/render@0.0.12";
import { NotificationEmail } from "./_templates/notification.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const RESEND_GATEWAY_URL = "https://connector-gateway.lovable.dev/resend/emails";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_FROM = "SoMA+ <soma@lefil.com.br>";

const ALLOWED_ACTION_URL_HOSTS = new Set([
  "pla.soma.lefil.com.br",
  "zen-demand.lovable.app",
  "demandcharm-suite.lovable.app",
]);

const PREVIEW_HOST_PATTERN = /^([a-z0-9-]+\.)*lovable\.(app|dev)$/i;

type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface EmailRequest {
  to: string; // Can be email or user_id (UUID)
  subject: string;
  template: 'notification';
  templateData: {
    title: string;
    message: string;
    actionUrl?: string;
    actionText?: string;
    userName?: string;
    type?: 'info' | 'success' | 'warning' | 'error';
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateBoundedString(value: unknown, field: string, maxLength: number, required = true): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error(`${field} is required`);
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }

  const trimmed = value.trim();
  if (required && !trimmed) {
    throw new Error(`${field} is required`);
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${field} too long (max ${maxLength} characters)`);
  }

  return trimmed || undefined;
}

function validateActionUrl(value: unknown): string | undefined {
  const rawUrl = validateBoundedString(value, "templateData.actionUrl", 2048, false);
  if (!rawUrl) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("templateData.actionUrl must be an absolute URL");
  }

  const hostname = parsed.hostname.toLowerCase();
  const isAllowedHost = ALLOWED_ACTION_URL_HOSTS.has(hostname) || PREVIEW_HOST_PATTERN.test(hostname);
  if (parsed.protocol !== "https:" || !isAllowedHost) {
    throw new Error("templateData.actionUrl must use an approved app domain");
  }

  return parsed.toString();
}

// Check if string is a valid UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Verify JWT token and get user
async function verifyAuth(req: Request): Promise<{ userId: string | null; error: string | null }> {
  const authHeader = req.headers.get("authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { userId: null, error: "Missing or invalid authorization header" };
  }

  const token = authHeader.replace("Bearer ", "");
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { userId: null, error: "Server configuration error" };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error("Auth verification failed:", error);
      return { userId: null, error: "Invalid or expired token" };
    }

    return { userId: user.id, error: null };
  } catch (err) {
    console.error("Auth verification error:", err);
    return { userId: null, error: "Authentication failed" };
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Allow internal callers (edge-to-edge) using the service-role bearer to bypass
    // per-user auth. External callers still require a valid user JWT.
    const authHeader = req.headers.get("authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const isInternalCall = !!SUPABASE_SERVICE_ROLE_KEY && bearer === SUPABASE_SERVICE_ROLE_KEY;

    let userId: string | null = null;
    if (!isInternalCall) {
      const auth = await verifyAuth(req);
      if (auth.error || !auth.userId) {
        console.warn("Unauthorized email attempt:", auth.error);
        return new Response(
          JSON.stringify({ error: auth.error || "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      userId = auth.userId;
      console.log(`Email request from authenticated user: ${userId}`);
    } else {
      console.log("Email request from internal service-role caller");
    }


    const rawPayload = await req.json().catch(() => null);
    if (!isRecord(rawPayload)) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if ("html" in rawPayload || "from" in rawPayload) {
      return new Response(
        JSON.stringify({ error: "Raw HTML and custom sender fields are not allowed" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    let payload: EmailRequest;
    try {
      const to = validateBoundedString(rawPayload.to, "to", 64);
      const subject = validateBoundedString(rawPayload.subject, "subject", 200);
      const template = rawPayload.template;
      if (template !== "notification" || !isRecord(rawPayload.templateData)) {
        throw new Error("A valid notification template is required");
      }

      const rawTemplateData = rawPayload.templateData;
      const rawType = rawTemplateData.type;
      const type = rawType === undefined ? undefined : String(rawType);
      if (type && !["info", "success", "warning", "error"].includes(type)) {
        throw new Error("templateData.type is invalid");
      }

      payload = {
        to: to!,
        subject: subject!,
        template: "notification",
        templateData: {
          title: validateBoundedString(rawTemplateData.title, "templateData.title", 200)!,
          message: validateBoundedString(rawTemplateData.message, "templateData.message", 5000)!,
          actionUrl: validateActionUrl(rawTemplateData.actionUrl),
          actionText: validateBoundedString(rawTemplateData.actionText, "templateData.actionText", 80, false),
          userName: validateBoundedString(rawTemplateData.userName, "templateData.userName", 120, false),
          type: type as NotificationType | undefined,
        },
      };
    } catch (validationError) {
      return new Response(
        JSON.stringify({ error: validationError instanceof Error ? validationError.message : "Invalid email payload" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { to, subject, templateData } = payload;

    let recipientEmail = to;
    let recipientUserId: string | null = null;

    // Only allow sending to UUIDs (internal user IDs). Block arbitrary email addresses
    // to prevent abuse of the SoMA+ sender identity for phishing.
    if (!isUUID(to)) {
      console.warn(`User ${userId} attempted to send to non-UUID recipient: ${to}`);
      return new Response(
        JSON.stringify({ error: "Forbidden: direct email to arbitrary addresses is not allowed" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // If 'to' is a UUID, lookup the user's email from Supabase Auth
    if (isUUID(to)) {
      recipientUserId = to;
      console.log(`Looking up email for user_id: ${to}`);
      
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.error("Missing Supabase credentials for user lookup");
        return new Response(
          JSON.stringify({ error: "Server configuration error" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(to);
      
      if (userError || !userData?.user?.email) {
        console.error("Error fetching user email:", userError);
        return new Response(
          JSON.stringify({ error: "Could not find user email" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      recipientEmail = userData.user.email;
      console.log(`Found email for user: ${recipientEmail}`);

      // Authorization: caller must share a team with the recipient (prevents arbitrary cross-user emails)
      const { data: sharedTeam } = await supabaseAdmin
        .from("team_members")
        .select("team_id")
        .eq("user_id", userId)
        .in(
          "team_id",
          (
            await supabaseAdmin
              .from("team_members")
              .select("team_id")
              .eq("user_id", recipientUserId)
          ).data?.map((r: { team_id: string }) => r.team_id) || []
        )
        .limit(1);

      if (userId !== recipientUserId && (!sharedTeam || sharedTeam.length === 0)) {
        console.warn(`User ${userId} attempted to email user ${recipientUserId} without shared team`);
        return new Response(
          JSON.stringify({ error: "Forbidden: recipient not in your team" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // Respect recipient notification preferences (emailNotifications toggle)
    try {
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        // Resolve user_id from email if needed
        if (!recipientUserId) {
          const { data: list } = await adminClient.auth.admin.listUsers();
          const match = list?.users?.find(
            (u) => (u.email || "").toLowerCase() === recipientEmail.toLowerCase()
          );
          if (match) recipientUserId = match.id;
        }

        if (recipientUserId) {
          const { data: prefRow } = await adminClient
            .from("user_preferences")
            .select("preference_value")
            .eq("user_id", recipientUserId)
            .eq("preference_key", "notification_preferences")
            .maybeSingle();

          const prefs = (prefRow?.preference_value || {}) as Record<string, unknown>;
          if (prefs.emailNotifications === false) {
            console.log(`Skipping email to ${recipientEmail}: emailNotifications disabled`);
            return new Response(
              JSON.stringify({ success: true, skipped: true, reason: "emailNotifications disabled" }),
              { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }
        }
      }
    } catch (prefErr) {
      console.warn("Could not check notification preferences, proceeding to send:", prefErr);
    }

    console.log('Rendering notification template for:', templateData.title);
    const emailHtml = await render(
      React.createElement(NotificationEmail, {
        title: templateData.title,
        message: templateData.message,
        actionUrl: templateData.actionUrl,
        actionText: templateData.actionText,
        userName: templateData.userName,
        type: templateData.type,
      })
    );

    console.log(`Sending email to ${recipientEmail} with subject: ${subject}`);

    // Helper function to send with retry for rate limiting
    const sendWithRetry = async (maxRetries = 3): Promise<{ success: boolean; data?: any; status?: number }> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
          console.error("Missing LOVABLE_API_KEY or RESEND_API_KEY for Resend gateway");
          return { success: false, status: 500 };
        }
        const res = await fetch(RESEND_GATEWAY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: DEFAULT_FROM,
            to: [recipientEmail],
            subject,
            html: emailHtml,
          }),
        });

        const data = await res.json();

        if (res.ok) {
          return { success: true, data };
        }

        // If rate limited (429), wait and retry
        if (res.status === 429 && attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 500; // 1s, 2s, 4s
          console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        console.error(`Resend gateway error [${res.status}]:`, data);
        return { success: false, data, status: res.status };
      }
      
      return { success: false, status: 429 };
    };

    const result = await sendWithRetry();

    if (!result.success) {
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: result.status || 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const data = result.data;

    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

Deno.serve(handler);
