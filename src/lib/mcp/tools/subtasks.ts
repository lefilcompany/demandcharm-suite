import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireAuth, ok, fromPgError } from "../_shared/supabase";

export const listSubtasksTool = defineTool({
  name: "list_subtasks",
  title: "List subtasks (checklist)",
  description: "List checklist subtasks of a demand.",
  inputSchema: { demand_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ demand_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demand_subtasks").select("*").eq("demand_id", demand_id).order("position");
    if (error) return fromPgError(error);
    return ok({ subtasks: data ?? [] });
  },
});

export const createSubtaskTool = defineTool({
  name: "create_subtask",
  title: "Create subtask",
  description: "Add a checklist item to a demand.",
  inputSchema: { demand_id: z.string().uuid(), title: z.string().trim().min(1).max(300) },
  annotations: { readOnlyHint: false, idempotentHint: false },
  handler: async ({ demand_id, title }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const c = sb(ctx);
    const { data: last } = await c.from("demand_subtasks").select("position").eq("demand_id", demand_id).order("position", { ascending: false }).limit(1).maybeSingle();
    const position = (last?.position ?? -1) + 1;
    const { data, error } = await c.from("demand_subtasks").insert({ demand_id, title, position, created_by: ctx.getUserId() }).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ subtask: data });
  },
});

export const toggleSubtaskTool = defineTool({
  name: "toggle_subtask",
  title: "Toggle subtask done",
  description: "Toggle subtask done.",
  inputSchema: { subtask_id: z.string().uuid(), completed: z.boolean() },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ subtask_id, completed }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demand_subtasks").update({ completed }).eq("id", subtask_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ subtask: data });
  },
});

export const updateSubtaskTool = defineTool({
  name: "update_subtask",
  title: "Update subtask",
  description: "Update subtask.",
  inputSchema: { subtask_id: z.string().uuid(), title: z.string().trim().min(1).max(300) },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ subtask_id, title }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demand_subtasks").update({ title }).eq("id", subtask_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ subtask: data });
  },
});

export const deleteSubtaskTool = defineTool({
  name: "delete_subtask",
  title: "Delete subtask",
  description: "Delete subtask.",
  inputSchema: { subtask_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true },
  handler: async ({ subtask_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { error } = await sb(ctx).from("demand_subtasks").delete().eq("id", subtask_id);
    if (error) return fromPgError(error);
    return ok({ deleted: subtask_id });
  },
});
