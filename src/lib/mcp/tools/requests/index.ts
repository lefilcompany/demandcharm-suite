import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "../../_shared/supabase";
import { ok, okList, okCreated, okUpdated, err, fromPgError, requireAuth } from "../../_shared/envelope";
import { urls } from "../../_shared/urls";
import { zUuid, zPriority } from "../../_shared/zod-common";

export const listDemandRequestsTool = defineTool({
  name: "list_demand_requests",
  title: "List demand requests",
  description: "List demand requests (solicitations) for a team, filterable by status.",
  inputSchema: {
    team_id: zUuid,
    status: z.enum(["pending", "approved", "rejected", "returned"]).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id, status, limit }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    let q = sb(ctx).from("demand_requests").select("*").eq("team_id", team_id)
      .order("created_at", { ascending: false }).limit(limit ?? 50);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return okList("requests", data ?? []);
  },
});

export const getDemandRequestTool = defineTool({
  name: "get_demand_request",
  title: "Get demand request",
  description: "Fetch a demand request by id.",
  inputSchema: { request_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ request_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demand_requests").select("*").eq("id", request_id).maybeSingle();
    if (error) return fromPgError(error);
    if (!data) return err("NOT_FOUND", "Request not found");
    return ok({ request: data }, { open_url: urls.request(request_id) });
  },
});

export const createDemandRequestTool = defineTool({
  name: "create_demand_request",
  title: "Create demand request",
  description: "Create a solicitation. Use when the user is a requester or shouldn't create a demand directly.",
  inputSchema: {
    team_id: zUuid,
    title: z.string().min(1).max(500),
    description: z.string().max(20000).optional(),
    board_id: zUuid.optional(),
    service_id: zUuid.optional(),
    priority: zPriority.optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demand_requests")
      .insert({ ...input, created_by: ctx.getUserId(), status: "pending" }).select().maybeSingle();
    if (error) return fromPgError(error);
    return okCreated({ request: data }, { open_url: data ? urls.request(data.id) : null });
  },
});

export const respondToRequestTool = defineTool({
  name: "respond_to_request",
  title: "Respond to demand request",
  description: "Approve, reject or return a demand request for adjustment.",
  inputSchema: {
    request_id: zUuid,
    action: z.enum(["approve", "reject", "return"]),
    reason: z.string().max(2000).optional().describe("Required for reject/return."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ request_id, action, reason }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    if ((action === "reject" || action === "return") && !reason)
      return err("VALIDATION", "Reason is required for reject/return");
    const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "returned";
    const patch: Record<string, unknown> = {
      status, responded_by: ctx.getUserId(), responded_at: new Date().toISOString(),
    };
    if (reason) patch.rejection_reason = reason;
    const { data, error } = await sb(ctx).from("demand_requests").update(patch).eq("id", request_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return okUpdated({ request: data }, { open_url: urls.request(request_id) });
  },
});
