import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "../../_shared/supabase";
import { ok, okList, okDeleted, err, fromPgError, requireAuth } from "../../_shared/envelope";
import { zUuid } from "../../_shared/zod-common";

export const listAttachmentsTool = defineTool({
  name: "list_attachments",
  title: "List attachments",
  description: "List file attachments on a demand (metadata only).",
  inputSchema: { demand_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ demand_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demand_attachments")
      .select("id, demand_id, file_name, file_path, file_size, file_type, uploaded_by, created_at")
      .eq("demand_id", demand_id).order("created_at", { ascending: false });
    if (error) return fromPgError(error);
    return okList("attachments", data ?? []);
  },
});

export const getAttachmentUrlTool = defineTool({
  name: "get_attachment_url",
  title: "Get attachment download URL",
  description: "Generate a short-lived signed URL to download an attachment.",
  inputSchema: { attachment_id: zUuid, expires_in_seconds: z.number().int().min(60).max(3600).optional() },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ attachment_id, expires_in_seconds }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const client = sb(ctx);
    const { data: att, error } = await client.from("demand_attachments").select("file_path, file_name").eq("id", attachment_id).maybeSingle();
    if (error) return fromPgError(error);
    if (!att) return err("NOT_FOUND", "Attachment not found");
    const { data: signed, error: sErr } = await client.storage.from("demand-attachments").createSignedUrl(att.file_path, expires_in_seconds ?? 600);
    if (sErr) return err("DB_ERROR", sErr.message);
    return ok({ url: signed.signedUrl, file_name: att.file_name, expires_in: expires_in_seconds ?? 600 });
  },
});

export const deleteAttachmentTool = defineTool({
  name: "delete_attachment",
  title: "Delete attachment",
  description: "Delete an attachment (removes both storage object and database record).",
  inputSchema: { attachment_id: zUuid },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ attachment_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const client = sb(ctx);
    const { data: att } = await client.from("demand_attachments").select("file_path").eq("id", attachment_id).maybeSingle();
    if (att?.file_path) await client.storage.from("demand-attachments").remove([att.file_path]);
    const { error } = await client.from("demand_attachments").delete().eq("id", attachment_id);
    if (error) return fromPgError(error);
    return okDeleted(attachment_id);
  },
});

export const requestAttachmentUploadTool = defineTool({
  name: "request_attachment_upload",
  title: "Request attachment upload URL",
  description: "Reserve an attachment record and return a short-lived signed upload URL. After PUT, call `confirm_attachment_upload`.",
  inputSchema: {
    demand_id: zUuid,
    file_name: z.string().min(1).max(400),
    content_type: z.string().min(1).max(200),
    file_size: z.number().int().min(0).max(50 * 1024 * 1024),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ demand_id, file_name, content_type, file_size }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const client = sb(ctx);
    const path = `${ctx.getUserId()}/${demand_id}/${crypto.randomUUID()}-${file_name}`;
    const { data: signed, error: sErr } = await client.storage.from("demand-attachments").createSignedUploadUrl(path);
    if (sErr) return err("DB_ERROR", sErr.message);
    return ok({
      upload_url: signed.signedUrl,
      storage_path: path,
      file_name, content_type, file_size,
      instructions: "PUT the file bytes to `upload_url`, then call `confirm_attachment_upload` with the returned storage_path.",
    });
  },
});

export const confirmAttachmentUploadTool = defineTool({
  name: "confirm_attachment_upload",
  title: "Confirm attachment upload",
  description: "Persist a completed upload as a demand_attachments record.",
  inputSchema: {
    demand_id: zUuid,
    storage_path: z.string().min(1),
    file_name: z.string().min(1),
    content_type: z.string().min(1),
    file_size: z.number().int().min(0),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demand_attachments").insert({
      demand_id: input.demand_id,
      file_path: input.storage_path,
      file_name: input.file_name,
      file_type: input.content_type,
      file_size: input.file_size,
      uploaded_by: ctx.getUserId(),
    }).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ success: true, attachment: data });
  },
});
