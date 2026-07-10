import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireAuth, ok, fromPgError } from "../_shared/supabase";

export const listNotesTool = defineTool({
  name: "list_notes",
  title: "List notes",
  description: "List notes of a team the caller can access.",
  inputSchema: {
    team_id: z.string().uuid(),
    archived: z.boolean().default(false),
    query: z.string().optional().describe("Optional text search on title/content."),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ team_id, archived, query, limit }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    let q = sb(ctx).from("notes").select("*").eq("team_id", team_id).eq("archived", archived).order("updated_at", { ascending: false }).limit(limit);
    if (query) {
      const esc = query.replace(/[%_]/g, (m) => `\\${m}`);
      q = q.or(`title.ilike.%${esc}%,content.ilike.%${esc}%`);
    }
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return ok({ notes: data ?? [] });
  },
});

export const getNoteTool = defineTool({
  name: "get_note",
  title: "Get note",
  description: "Get note.",
  inputSchema: { note_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ note_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("notes").select("*").eq("id", note_id).maybeSingle();
    if (error) return fromPgError(error);
    return ok({ note: data });
  },
});

export const createNoteTool = defineTool({
  name: "create_note",
  title: "Create note",
  description: "Create note.",
  inputSchema: {
    team_id: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    content: z.string().default(""),
    is_private: z.boolean().default(true),
  },
  annotations: { readOnlyHint: false, idempotentHint: false },
  handler: async (input, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("notes").insert({ ...input, created_by: ctx.getUserId() }).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ note: data });
  },
});

export const updateNoteTool = defineTool({
  name: "update_note",
  title: "Update note",
  description: "Update note.",
  inputSchema: {
    note_id: z.string().uuid(),
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().optional(),
    is_private: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ note_id, ...patch }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (!Object.keys(clean).length) return ok({ updated: false });
    const { data, error } = await sb(ctx).from("notes").update(clean).eq("id", note_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ note: data });
  },
});

export const archiveNoteTool = defineTool({
  name: "archive_note",
  title: "Archive/restore note",
  description: "Archive/restore note.",
  inputSchema: { note_id: z.string().uuid(), archived: z.boolean().default(true) },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  handler: async ({ note_id, archived }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("notes").update({ archived }).eq("id", note_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ note: data });
  },
});

export const deleteNoteTool = defineTool({
  name: "delete_note",
  title: "Delete note",
  description: "Delete note.",
  inputSchema: { note_id: z.string().uuid(), confirm: z.literal(true) },
  annotations: { readOnlyHint: false, destructiveHint: true },
  handler: async ({ note_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { error } = await sb(ctx).from("notes").delete().eq("id", note_id);
    if (error) return fromPgError(error);
    return ok({ deleted: note_id });
  },
});

export const shareNoteTool = defineTool({
  name: "share_note_with_user",
  title: "Share note with user",
  description: "Share note with user.",
  inputSchema: { note_id: z.string().uuid(), user_id: z.string().uuid(), permission: z.enum(["view", "edit"]).default("view") },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ note_id, user_id, permission }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("note_shares")
      .upsert({ note_id, shared_with_user_id: user_id, permission, shared_by: ctx.getUserId() }, { onConflict: "note_id,shared_with_user_id" }).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ share: data });
  },
});

export const revokeNoteShareTool = defineTool({
  name: "revoke_note_share",
  title: "Revoke note share",
  description: "Revoke note share.",
  inputSchema: { note_id: z.string().uuid(), user_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true },
  handler: async ({ note_id, user_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { error } = await sb(ctx).from("note_shares").delete().eq("note_id", note_id).eq("shared_with_user_id", user_id);
    if (error) return fromPgError(error);
    return ok({ revoked: user_id });
  },
});
