import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "../../_shared/supabase";
import { ok, okList, okCreated, okUpdated, err, fromPgError, requireAuth } from "../../_shared/envelope";
import { urls } from "../../_shared/urls";
import { zUuid } from "../../_shared/zod-common";

export const listNotesTool = defineTool({
  name: "list_notes",
  title: "List notes",
  description: "List notes accessible to the user in a team.",
  inputSchema: { team_id: zUuid, include_archived: z.boolean().optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id, include_archived }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    let q = sb(ctx).from("notes").select("id, title, icon, cover_url, archived, is_public, tags, parent_id, updated_at, created_at, created_by")
      .eq("team_id", team_id).order("updated_at", { ascending: false });
    if (!include_archived) q = q.eq("archived", false);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return okList("notes", data ?? []);
  },
});

export const getNoteTool = defineTool({
  name: "get_note",
  title: "Get note",
  description: "Fetch a note by id with its full content.",
  inputSchema: { note_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ note_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("notes").select("*").eq("id", note_id).maybeSingle();
    if (error) return fromPgError(error);
    if (!data) return err("NOT_FOUND", "Note not found");
    return ok({ note: data }, { open_url: urls.note(note_id) });
  },
});

export const createNoteTool = defineTool({
  name: "create_note",
  title: "Create note",
  description: "Create a new note (rich text content).",
  inputSchema: {
    team_id: zUuid,
    title: z.string().min(1).max(300),
    content: z.string().max(200000).optional(),
    icon: z.string().max(20).optional(),
    tags: z.array(z.string()).max(20).optional(),
    parent_id: zUuid.optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("notes").insert({ ...input, created_by: ctx.getUserId() }).select().maybeSingle();
    if (error) return fromPgError(error);
    return okCreated({ note: data }, { open_url: data ? urls.note(data.id) : null });
  },
});

export const updateNoteTool = defineTool({
  name: "update_note",
  title: "Update note",
  description: "Update note title/content/icon/tags.",
  inputSchema: {
    note_id: zUuid,
    title: z.string().min(1).max(300).optional(),
    content: z.string().max(200000).optional(),
    icon: z.string().max(20).optional(),
    tags: z.array(z.string()).max(20).optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ note_id, ...patch }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    Object.keys(patch).forEach(k => (patch as any)[k] === undefined && delete (patch as any)[k]);
    if (!Object.keys(patch).length) return err("VALIDATION", "No fields to update");
    const { data, error } = await sb(ctx).from("notes").update(patch).eq("id", note_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return okUpdated({ note: data });
  },
});

export const archiveNoteTool = defineTool({
  name: "archive_note",
  title: "Archive note",
  description: "Archive a note (reversible).",
  inputSchema: { note_id: zUuid },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ note_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("notes").update({ archived: true }).eq("id", note_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return okUpdated({ note: data });
  },
});
