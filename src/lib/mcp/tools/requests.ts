import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireAuth, ok, fromPgError } from "../_shared/supabase";

const requestStatus = z.enum(["pending", "approved", "rejected", "returned"]);

export const listDemandRequestsTool = defineTool({
  name: "list_demand_requests",
  title: "List demand requests",
  description: "List demand approval requests (submitted by requesters) visible to the caller.",
  inputSchema: {
    team_id: z.string().uuid().optional(),
    board_id: z.string().uuid().optional(),
    status: requestStatus.optional(),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ team_id, board_id, status, limit }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    let q = sb(ctx).from("demand_requests").select("*").order("created_at", { ascending: false }).limit(limit);
    if (team_id) q = q.eq("team_id", team_id);
    if (board_id) q = q.eq("board_id", board_id);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return ok({ requests: data ?? [] });
  },
});

export const getDemandRequestTool = defineTool({
  name: "get_demand_request",
  title: "Get demand request",
  description: "Get demand request.",
  inputSchema: { request_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ request_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const c = sb(ctx);
    const { data, error } = await c.from("demand_requests").select("*").eq("id", request_id).maybeSingle();
    if (error) return fromPgError(error);
    const { data: comments } = await c.from("demand_request_comments").select("*, profiles(id, full_name, avatar_url)").eq("request_id", request_id).order("created_at");
    return ok({ request: data, comments: comments ?? [] });
  },
});

export const createDemandRequestTool = defineTool({
  name: "create_demand_request",
  title: "Create demand request",
  description: "Submit a demand request for approval on a team (optionally targeting a board).",
  inputSchema: {
    team_id: z.string().uuid(),
    board_id: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(200),
    description: z.string().optional(),
    priority: z.enum(["baixa", "média", "alta", "urgente"]).default("média"),
    due_date: z.string().datetime({ offset: true }).optional(),
    service_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false },
  handler: async (input, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demand_requests").insert({ ...input, created_by: ctx.getUserId(), status: "pending" }).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ request: data });
  },
});

export const respondDemandRequestTool = defineTool({
  name: "respond_demand_request",
  title: "Approve/reject/return request",
  description: "Change a demand request status to approved, rejected, or returned. Provide reason for rejected/returned.",
  inputSchema: {
    request_id: z.string().uuid(),
    action: z.enum(["approved", "rejected", "returned"]),
    reason: z.string().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ request_id, action, reason }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const patch: Record<string, unknown> = { status: action, responded_by: ctx.getUserId(), responded_at: new Date().toISOString() };
    if (action !== "approved") patch.rejection_reason = reason ?? null;
    const { data, error } = await sb(ctx).from("demand_requests").update(patch).eq("id", request_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ request: data });
  },
});

export const postRequestCommentTool = defineTool({
  name: "post_request_comment",
  title: "Post request comment",
  description: "Post request comment.",
  inputSchema: { request_id: z.string().uuid(), content: z.string().trim().min(1).max(5000) },
  annotations: { readOnlyHint: false, idempotentHint: false },
  handler: async ({ request_id, content }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demand_request_comments")
      .insert({ request_id, content, user_id: ctx.getUserId() }).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ comment: data });
  },
});
