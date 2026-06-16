import React from "npm:react@18.3.1";
import { render } from "npm:@react-email/render@0.0.12";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Heading,
  Hr,
  Img,
  Link,
} from "npm:@react-email/components@0.0.22";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotifyRequest {
  requestId: string;
  teamId: string;
  boardId: string;
  title: string;
  description?: string;
  priority: string;
  requesterName: string;
}

// Email template component
const DemandRequestEmail = ({
  title,
  description,
  priority,
  requesterName,
  boardName,
  actionUrl,
}: {
  title: string;
  description?: string;
  priority: string;
  requesterName: string;
  boardName: string;
  actionUrl: string;
}) => {
  const priorityColors: Record<string, string> = {
    baixa: "#22c55e",
    média: "#eab308",
    alta: "#ef4444",
  };

  return React.createElement(
    Html,
    null,
    React.createElement(Head, null),
    React.createElement(
      Body,
      {
        style: {
          backgroundColor: "#f5f5f5",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
      },
      React.createElement(
        Container,
        {
          style: {
            margin: "0 auto",
            padding: "20px 0",
            maxWidth: "600px",
          },
        },
        // Header with logo
        React.createElement(
          Section,
          {
            style: {
              backgroundColor: "#ffffff",
              borderRadius: "12px 12px 0 0",
              padding: "32px 40px 24px",
              textAlign: "center" as const,
            },
          },
          React.createElement(Img, {
            src: "https://pla.soma.lefil.com.br/lovable-uploads/8967ad53-156a-4e31-a5bd-b472b7cde839.png",
            alt: "SoMA+",
            width: "150",
            height: "50",
            style: { margin: "0 auto" },
          })
        ),
        // Accent bar
        React.createElement("div", {
          style: {
            height: "4px",
            width: "100%",
            backgroundColor: "#F28705",
          },
        }),
        // Main content
        React.createElement(
          Section,
          {
            style: {
              backgroundColor: "#ffffff",
              padding: "32px 40px",
            },
          },
          React.createElement(
            Heading,
            {
              style: {
                color: "#1f2937",
                fontSize: "24px",
                fontWeight: "600",
                lineHeight: "1.3",
                margin: "0 0 16px",
              },
            },
            "Nova Solicitação de Demanda"
          ),
        React.createElement(
          Text,
          { style: { color: "#6b7280", fontSize: "16px", marginBottom: "24px" } },
          `${requesterName} enviou uma nova solicitação de demanda no quadro "${boardName}".`
        ),
        React.createElement(Hr, { style: { borderColor: "#e5e7eb", margin: "24px 0" } }),
        React.createElement(
          Section,
          { style: { marginBottom: "24px" } },
          React.createElement(
            Text,
            {
              style: {
                color: "#374151",
                fontSize: "14px",
                fontWeight: "600",
                marginBottom: "8px",
              },
            },
            "Título:"
          ),
          React.createElement(
            Text,
            { style: { color: "#1f2937", fontSize: "18px", fontWeight: "bold", margin: 0 } },
            title
          )
        ),
        description &&
          React.createElement(
            Section,
            { style: { marginBottom: "24px" } },
            React.createElement(
              Text,
              {
                style: {
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: "8px",
                },
              },
              "Descrição:"
            ),
            React.createElement(
              Text,
              { style: { color: "#6b7280", fontSize: "14px", margin: 0 } },
              description
            )
          ),
        React.createElement(
          Section,
          { style: { marginBottom: "24px" } },
          React.createElement(
            Text,
            {
              style: {
                color: "#374151",
                fontSize: "14px",
                fontWeight: "600",
                marginBottom: "8px",
              },
            },
            "Prioridade:"
          ),
          React.createElement(
            Text,
            {
              style: {
                color: priorityColors[priority] || "#6b7280",
                fontSize: "14px",
                fontWeight: "600",
                margin: 0,
                textTransform: "capitalize",
              },
            },
            priority
          )
        ),
        React.createElement(Hr, { style: { borderColor: "#e5e7eb", margin: "24px 0" } }),
          React.createElement(
            Section,
            { style: { textAlign: "center" as const, margin: "24px 0" } },
            React.createElement(
              Button,
              {
                href: actionUrl,
                style: {
                  backgroundColor: "#F28705",
                  borderRadius: "8px",
                  color: "#ffffff",
                  fontSize: "16px",
                  fontWeight: "600",
                  textDecoration: "none",
                  textAlign: "center" as const,
                  display: "inline-block",
                  padding: "14px 32px",
                },
              },
              "Ver Solicitação"
            )
          )
        ),
        // Divider
        React.createElement(Hr, { style: { borderColor: "#e5e7eb", margin: "0" } }),
        // Footer
        React.createElement(
          Section,
          {
            style: {
              backgroundColor: "#ffffff",
              borderRadius: "0 0 12px 12px",
              padding: "24px 40px 32px",
              textAlign: "center" as const,
            },
          },
          React.createElement(
            Text,
            {
              style: {
                color: "#9ca3af",
                fontSize: "12px",
                lineHeight: "1.5",
                margin: "0 0 8px",
              },
            },
            "Esta é uma notificação automática do sistema SoMA+."
          ),
          React.createElement(
            Text,
            {
              style: {
                color: "#9ca3af",
                fontSize: "12px",
                lineHeight: "1.5",
                margin: "0 0 16px",
              },
            },
            "Se você não esperava este email, pode ignorá-lo com segurança."
          ),
          React.createElement(
            Link,
            {
              href: "https://pla.soma.lefil.com.br",
              style: {
                color: "#F28705",
                fontSize: "14px",
                fontWeight: "600",
                textDecoration: "none",
              },
            },
            "Acessar SoMA+"
          ),
          React.createElement(
            Text,
            {
              style: {
                color: "#9ca3af",
                fontSize: "11px",
                margin: "16px 0 0",
              },
            },
            `© ${new Date().getFullYear()} SoMA+. Todos os direitos reservados.`
          )
        )
      )
    )
  );
};

// Verify JWT token and get user
async function verifyAuth(
  req: Request
): Promise<{ userId: string | null; error: string | null }> {
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

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

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
    // Verify authentication
    const { userId, error: authError } = await verifyAuth(req);

    if (authError || !userId) {
      console.warn("Unauthorized request:", authError);
      return new Response(JSON.stringify({ error: authError || "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Notify demand request from user: ${userId}`);

    const { requestId }: NotifyRequest = await req.json();

    if (!requestId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: requestId" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
      console.error("Missing required environment variables");
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

    // Trusted lookup: fetch the demand_request from DB and verify the caller owns it.
    const { data: requestRecord, error: requestErr } = await supabaseAdmin
      .from("demand_requests")
      .select("id, team_id, board_id, title, description, priority, created_by")
      .eq("id", requestId)
      .maybeSingle();

    if (requestErr || !requestRecord) {
      return new Response(
        JSON.stringify({ error: "Request not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (requestRecord.created_by !== userId) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const teamId = requestRecord.team_id as string;
    const boardId = requestRecord.board_id as string;
    const title = requestRecord.title as string;
    const description = (requestRecord.description as string | null) || undefined;
    const priority = (requestRecord.priority as string) || "média";

    if (!boardId) {
      return new Response(
        JSON.stringify({ error: "Request has no board associated" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Derive requesterName from the authenticated user's profile (never trust client input)
    const { data: requesterProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const requesterName = requesterProfile?.full_name || "Um usuário";

    // Get board name
    const { data: board } = await supabaseAdmin
      .from("boards")
      .select("name")
      .eq("id", boardId)
      .single();

    const boardName = board?.name || "Quadro";

    // Get all admins, moderators and executors from the specific board
    const { data: boardMembers, error: membersError } = await supabaseAdmin
      .from("board_members")
      .select("user_id")
      .eq("board_id", boardId)
      .in("role", ["admin", "moderator", "executor"]);

    if (membersError) {
      console.error("Error fetching board members:", membersError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch board members" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!boardMembers || boardMembers.length === 0) {
      console.log("No board members found for board:", boardId);
      return new Response(JSON.stringify({ success: true, emailsSent: 0, notificationsCreated: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Found ${boardMembers.length} admins/moderators/executors to notify for board ${boardId}`);

    // Create in-app notifications for all board members (except the requester)
    const notificationsToInsert = boardMembers
      .filter((m: { user_id: string }) => m.user_id !== userId)
      .map((m: { user_id: string }) => ({
        user_id: m.user_id,
        title: `[${boardName}] Nova solicitação de demanda`,
        message: `${requesterName} enviou uma nova solicitação: "${title}"`,
        type: "demand_request",
        link: "/demand-requests",
        read: false,
      }));

    let notificationsCreated = 0;
    if (notificationsToInsert.length > 0) {
      const { error: notifError, data: notifData } = await supabaseAdmin
        .from("notifications")
        .insert(notificationsToInsert)
        .select();

      if (notifError) {
        console.error("Error inserting in-app notifications:", notifError);
      } else {
        notificationsCreated = notifData?.length || 0;
        console.log(`Created ${notificationsCreated} in-app notifications`);
      }
    }

    // Get emails for all board members (admin, moderator, executor)
    const memberEmails: string[] = [];
    for (const member of boardMembers) {
      // Skip the requester (don't notify yourself)
      if (member.user_id === userId) continue;

      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(
        member.user_id
      );
      if (userData?.user?.email) {
        memberEmails.push(userData.user.email);
      }
    }

    if (memberEmails.length === 0) {
      console.log("No member emails found to notify");
      return new Response(JSON.stringify({ success: true, emailsSent: 0, notificationsCreated }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Sending emails to ${memberEmails.length} board members:`, memberEmails);

    // Generate the action URL
    const appUrl = "https://pla.soma.lefil.com.br"; // Production URL
    const actionUrl = `${appUrl}/demand-requests`;

    // Render email template
    const emailHtml = await render(
      React.createElement(DemandRequestEmail, {
        title,
        description,
        priority: priority || "média",
        requesterName,
        boardName,
        actionUrl,
      })
    );

    // Send email to all board members (admin, moderator, executor)
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SoMA+ <noreply@pla.soma.lefil.com.br>",
        to: memberEmails,
        subject: `Nova Solicitação de Demanda: ${title.substring(0, 50)}${title.length > 50 ? "..." : ""}`,
        html: emailHtml,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      return new Response(JSON.stringify({ error: "Failed to send emails" }), {
        status: res.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("Emails sent successfully:", data);

    return new Response(
      JSON.stringify({ success: true, emailsSent: memberEmails.length, notificationsCreated }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-demand-request function:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

Deno.serve(handler);
