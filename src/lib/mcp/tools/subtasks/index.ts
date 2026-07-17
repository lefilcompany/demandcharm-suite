import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "../../_shared/supabase";
import { okList, okCreated, okUpdated, okDeleted, err, fromPgError, requireAuth } from "../../_shared/envelope";
import { zUuid } from "../../_shared/zod-common";

export const listSubtasksTool = defineTool({
  name: "list_subtasks",
  title: "List subtasks",
  description: "List the checklist subtasks for a demand.",
  inputSchema: { demand_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ demand_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demand_subtasks").select("*").eq("demand_id", demand_id).order("sort_order");
    if (error) return fromPgError(error);
    return okList("subtasks", data ?? []);
  },
});

export const createSubtaskTool = defineTool({
  name: "create_subtask",
  title: "Create subtask",
  description: "Add a checklist item to a demand.",
  inputSchema: { demand_id: zUuid, title: z.string().min(1).max(500) },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ demand_id, title }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demand_subtasks").insert({ demand_id, title }).select().maybeSingle();
    if (error) return fromPgError(error);
    return okCreated({ subtask: data });
  },
});

export const toggleSubtaskTool = defineTool({
  name: "toggle_subtask",
  title: "Toggle subtask",
  description: "Mark a subtask as completed or not completed.",
  inputSchema: { subtask_id: zUuid, completed: z.boolean() },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ subtask_id, completed }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demand_subtasks").update({ completed }).eq("id", subtask_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return okUpdated({ subtask: data });
  },
});

export const updateSubtaskTool = defineTool({
  name: "update_subtask",
  title: "Update subtask",
  description: "Update the title of a subtask.",
  inputSchema: { subtask_id: zUuid, title: z.string().min(1).max(500) },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ subtask_id, title }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demand_subtasks").update({ title }).eq("id", subtask_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return okUpdated({ subtask: data });
  },
});

export const deleteSubtaskTool = defineTool({
  name: "delete_subtask",
  title: "Delete subtask",
  description: "Delete a subtask.",
  inputSchema: { subtask_id: zUuid },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ subtask_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { error } = await sb(ctx).from("demand_subtasks").delete().eq("id", subtask_id);
    if (error) return fromPgError(error);
    return okDeleted(subtask_id);
  },
});
