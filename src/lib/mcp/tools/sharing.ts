import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireAuth, ok, fromPgError } from "../_shared/supabase";

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const createDemandShareTokenTool = defineTool({
  name: "create_demand_share_token",
  title: "Create demand share link",
  description: "Create a public share token for a demand (optionally with expiry and auto_join_board).",
  inputSchema: {
    demand_id: z.string().uuid(),
    expires_at: z.string().datetime({ offset: true }).nullable().optional(),
    auto_join_board: z.boolean().default(false),
  },
  annotations: { readOnlyHint: false, idempotentHint: false },
  handler: async ({ demand_id, expires_at, auto_join_board }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const token = randomToken();
    const { data, error } = await sb(ctx).from("demand_share_tokens").insert({
      demand_id, token, expires_at: expires_at ?? null, auto_join_board, is_active: true, created_by: ctx.getUserId(),
    }).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ token: data });
  },
});

export const listDemandShareTokensTool = defineTool({
  name: "list_demand_share_tokens",
  title: "List demand share tokens",
  description: "List demand share tokens.",
  inputSchema: { demand_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ demand_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demand_share_tokens").select("*").eq("demand_id", demand_id).order("created_at", { ascending: false });
    if (error) return fromPgError(error);
    return ok({ tokens: data ?? [] });
  },
});

export const revokeDemandShareTokenTool = defineTool({
  name: "revoke_demand_share_token",
  title: "Revoke demand share token",
  description: "Revoke demand share token.",
  inputSchema: { token_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  handler: async ({ token_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demand_share_tokens").update({ is_active: false }).eq("id", token_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ token: data });
  },
});
