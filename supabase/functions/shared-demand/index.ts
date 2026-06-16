import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const createResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let token = "";

    try {
      const payload = await req.json();
      token = typeof payload?.token === "string" ? payload.token.trim() : "";
    } catch {
      return createResponse(400, {
        code: "BAD_REQUEST",
        error: "Invalid request body",
      });
    }

    if (!token) {
      return createResponse(400, {
        code: "BAD_REQUEST",
        error: "Missing token",
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: tokenData, error: tokenError } = await supabase
      .from("demand_share_tokens")
      .select("id, demand_id, is_active, expires_at, auto_join_board")
      .eq("token", token)
      .maybeSingle();

    if (tokenError) {
      console.error("Error validating token:", tokenError);
      return createResponse(500, {
        code: "LOAD_ERROR",
        error: "Failed to validate token",
      });
    }

    if (!tokenData || !tokenData.is_active) {
      return createResponse(403, {
        code: "INVALID_TOKEN",
        error: "Invalid or revoked token",
      });
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) <= new Date()) {
      await supabase
        .from("demand_share_tokens")
        .update({ is_active: false })
        .eq("id", tokenData.id);

      return createResponse(410, {
        code: "EXPIRED_TOKEN",
        error: "Token expired",
      });
    }

    const { data: demand, error: demandError } = await supabase
      .from("demands")
      .select(`
        id,
        title,
        description,
        priority,
        due_date,
        created_at,
        board_sequence_number,
        board_id,
        team_id,
        service_id,
        demand_statuses(name, color),
        profiles:profiles!demands_created_by_fkey(full_name, avatar_url),
        teams(id, name, description),
        services(id, name),
        demand_assignees(
          user_id,
          profile:profiles(full_name, avatar_url)
        )
      `)
      .eq("id", tokenData.demand_id)
      .maybeSingle();

    if (demandError) {
      console.error("Error loading shared demand:", demandError);
      return createResponse(500, {
        code: "LOAD_ERROR",
        error: "Failed to load demand",
      });
    }

    if (!demand) {
      return createResponse(404, {
        code: "INVALID_TOKEN",
        error: "Demand not found",
      });
    }

    const { data: interactions, error: interactionsError } = await supabase
      .from("demand_interactions")
      .select(`
        id,
        interaction_type,
        content,
        created_at,
        profiles(full_name, avatar_url)
      `)
      .eq("demand_id", tokenData.demand_id)
      .eq("channel", "general")
      .order("created_at", { ascending: false });

    if (interactionsError) {
      console.error("Error loading shared interactions:", interactionsError);
      return createResponse(500, {
        code: "LOAD_ERROR",
        error: "Failed to load interactions",
      });
    }

    const { data: attachments, error: attachmentsError } = await supabase
      .from("demand_attachments")
      .select(`
        id,
        file_name,
        file_path,
        file_type,
        file_size,
        created_at
      `)
      .eq("demand_id", tokenData.demand_id)
      .is("interaction_id", null)
      .order("created_at", { ascending: false });

    if (attachmentsError) {
      console.error("Error loading shared attachments:", attachmentsError);
      return createResponse(500, {
        code: "LOAD_ERROR",
        error: "Failed to load attachments",
      });
    }

    return createResponse(200, {
      demand,
      interactions: interactions || [],
      attachments: attachments || [],
      auto_join_board: !!tokenData.auto_join_board,
    });
  } catch (error) {
    console.error("Unexpected shared-demand error:", error);
    return createResponse(500, {
      code: "LOAD_ERROR",
      error: "Internal server error",
    });
  }
});
