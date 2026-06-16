import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const respond = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const respondMissingFile = (code: "ATTACHMENT_NOT_FOUND" | "FILE_NOT_FOUND", error: string) =>
  respond(200, { code, error, signedUrl: null, exists: false });

const BUCKET = "demand-attachments";

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeObjectPath(raw: string): string {
  return safeDecodeURIComponent(String(raw))
    .replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/(?:public|sign)\/[^/]+\//, "")
    .replace(/^\/+/, "")
    .replace(new RegExp(`^${BUCKET}/`), "")
    .replace(/^attachments\//, "")
    .replace(/\?.*$/, "")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return respond(401, { code: "UNAUTHORIZED", error: "Missing authorization header" });
    }

    const payload = await req.json().catch(() => null);
    const rawPath = payload?.filePath ?? payload?.path ?? payload?.url ?? "";
    const filePath = normalizeObjectPath(rawPath);

    if (!filePath) {
      return respond(400, { code: "BAD_REQUEST", error: "Missing filePath" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate user session
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return respond(401, { code: "UNAUTHORIZED", error: "Invalid user session" });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Find the attachment record
    const { data: attachment, error: attachmentError } = await adminClient
      .from("demand_attachments")
      .select("id, file_path, demand_id, demands!inner(board_id)")
      .eq("file_path", filePath)
      .maybeSingle();

    if (attachmentError) {
      console.error("Attachment lookup error:", attachmentError);
      return respond(500, { code: "ATTACHMENT_LOOKUP_ERROR", error: "Failed to validate attachment" });
    }

    if (!attachment) {
      return respondMissingFile("ATTACHMENT_NOT_FOUND", "Attachment not found");
    }

    // Check board membership
    const boardId = (attachment as { demands: { board_id: string } }).demands.board_id;
    const { data: membership } = await adminClient
      .from("board_members")
      .select("id")
      .eq("board_id", boardId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return respond(403, { code: "FORBIDDEN", error: "You do not have access to this attachment" });
    }

    // Generate signed URL
    const { data: signedData, error: signError } = await adminClient.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 3600);

    if (signError || !signedData?.signedUrl) {
      const isMissingFile =
        signError?.statusCode === "404" ||
        signError?.status === 400 ||
        signError?.message?.toLowerCase().includes("object not found");

      if (isMissingFile) {
        console.warn("Attachment missing in storage:", filePath);
        return respondMissingFile(
          "FILE_NOT_FOUND",
          "O arquivo não existe mais no armazenamento. Pode ter sido removido.",
        );
      }

      console.error("Signed URL error:", signError, "path:", filePath);

      return respond(500, {
        code: "SIGNED_URL_ERROR",
        error: "Failed to generate signed URL",
      });
    }

    return respond(200, { signedUrl: signedData.signedUrl });
  } catch (error) {
    console.error("Unexpected demand-attachment-url error:", error);
    return respond(500, { code: "LOAD_ERROR", error: "Internal server error" });
  }
});
