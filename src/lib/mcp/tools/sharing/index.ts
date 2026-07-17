import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "../../_shared/supabase";
import { ok, okList, okCreated, okDeleted, fromPgError, requireAuth } from "../../_shared/envelope";
import { zUuid } from "../../_shared/zod-common";

export const createDemandShareTokenTool = defineTool({
  name: "create_demand_share_token",
  title: "Create demand share link",
  description: "Create a public share link for a demand.",
  inputSchema: {
    demand_id: zUuid,
    expires_at: z.string().datetime({ offset: true }).optional(),
    auto_join_board: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ demand_id, expires_at, auto_join_board }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demand_share_tokens")
      .insert({ demand_id, created_by: ctx.getUserId(), expires_at, auto_join_board: !!auto_join_board })
      .select().maybeSingle();
    if (error) return fromPgError(error);
    return okCreated({ token: data });
  },
});

export const listDemandShareTokensTool = defineTool({
  name: "list_demand_share_tokens",
  title: "List demand share links",
  description: "List existing share tokens for a demand.",
  inputSchema: { demand_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ demand_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demand_share_tokens").select("*").eq("demand_id", demand_id);
    if (error) return fromPgError(error);
    return okList("tokens", data ?? []);
  },
});

export const revokeDemandShareTokenTool = defineTool({
  name: "revoke_demand_share_token",
  title: "Revoke demand share link",
  description: "Revoke (delete) a demand share token.",
  inputSchema: { token_id: zUuid },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ token_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { error } = await sb(ctx).from("demand_share_tokens").delete().eq("id", token_id);
    if (error) return fromPgError(error);
    return okDeleted(token_id);
  },
});
