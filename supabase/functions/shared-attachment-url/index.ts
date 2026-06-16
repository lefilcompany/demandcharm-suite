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
    const payload = await req.json().catch(() => null);
    const token = typeof payload?.token === "string" ? payload.token.trim() : "";
    const filePath = typeof payload?.filePath === "string" ? payload.filePath.trim() : "";

    if (!token || !filePath) {
      return createResponse(400, {
        code: "BAD_REQUEST",
        error: "Missing token or filePath",
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: tokenData, error: tokenError } = await supabase
      .from("demand_share_tokens")
      .select("id, demand_id, is_active, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenError) {
      console.error("Error validating attachment token:", tokenError);
      return createResponse(500, {
        code: "LOAD_ERROR",
        error: "Failed to validate share token",
      });
    }

    if (!tokenData || !tokenData.is_active) {
      return createResponse(403, {
        code: "INVALID_TOKEN",
        error: "Invalid or revoked share token",
      });
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) <= new Date()) {
      await supabase
        .from("demand_share_tokens")
        .update({ is_active: false })
        .eq("id", tokenData.id);

      return createResponse(410, {
        code: "EXPIRED_TOKEN",
        error: "Share token expired",
      });
    }

    const { data: attachment, error: attachError } = await supabase
      .from("demand_attachments")
      .select("id")
      .eq("demand_id", tokenData.demand_id)
      .eq("file_path", filePath)
      .maybeSingle();

    if (attachError || !attachment) {
      return createResponse(404, {
        code: "ATTACHMENT_NOT_FOUND",
        error: "Attachment not found for this shared demand",
      });
    }

    const { data: signedData, error: signError } = await supabase.storage
      .from("demand-attachments")
      .createSignedUrl(filePath, 3600);

    if (signError || !signedData?.signedUrl) {
      console.error("Error creating signed URL:", signError);
      return createResponse(500, {
        code: "SIGNED_URL_ERROR",
        error: "Failed to generate signed URL",
      });
    }

    return createResponse(200, { signedUrl: signedData.signedUrl });
  } catch (error) {
    console.error("Unexpected shared-attachment-url error:", error);
    return createResponse(500, {
      code: "LOAD_ERROR",
      error: "Internal server error",
    });
  }
});
