import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireAuth, ok, fromPgError } from "../_shared/supabase";

export const listAttachmentsTool = defineTool({
  name: "list_demand_attachments",
  title: "List demand attachments",
  description: "List file attachments metadata of a demand. Use `get_attachment_url` to obtain a signed download URL.",
  inputSchema: { demand_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ demand_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demand_attachments").select("*").eq("demand_id", demand_id).order("created_at", { ascending: false });
    if (error) return fromPgError(error);
    return ok({ attachments: data ?? [] });
  },
});

export const getAttachmentUrlTool = defineTool({
  name: "get_attachment_url",
  title: "Get attachment signed URL",
  description: "Return a short-lived signed URL to download a demand attachment.",
  inputSchema: { attachment_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: false },
  handler: async ({ attachment_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).functions.invoke("demand-attachment-url", { body: { attachment_id } });
    if (error) return fromPgError({ message: error.message });
    return ok(data as Record<string, unknown>);
  },
});

export const deleteAttachmentTool = defineTool({
  name: "delete_demand_attachment",
  title: "Delete demand attachment",
  description: "Delete demand attachment.",
  inputSchema: { attachment_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true },
  handler: async ({ attachment_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { error } = await sb(ctx).from("demand_attachments").delete().eq("id", attachment_id);
    if (error) return fromPgError(error);
    return ok({ deleted: attachment_id });
  },
});
