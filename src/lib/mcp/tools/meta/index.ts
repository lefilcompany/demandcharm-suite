import { defineTool } from "@lovable.dev/mcp-js";
import { ok } from "../../_shared/envelope";
import { urls } from "../../_shared/urls";

export const pingTool = defineTool({
  name: "ping",
  title: "Ping",
  description: "Health check. Returns pong + server timestamp.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => ok({ pong: true }),
});

export const getServerVersionTool = defineTool({
  name: "get_server_version",
  title: "Server version",
  description: "Return MCP server version and canonical documentation URL.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => ok({
    name: "soma-mcp",
    version: "2.0.0",
    docs_url: urls.mcpDocs(),
    protocol: "Model Context Protocol / Streamable HTTP",
  }),
});

export const listCapabilitiesTool = defineTool({
  name: "list_capabilities",
  title: "List capabilities",
  description: "Enumerate the domains and feature flags exposed by this MCP server. Use for discovery.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => ok({
    domains: [
      "session", "teams", "boards", "demands", "subtasks", "comments", "attachments",
      "time", "services", "notes", "projects", "requests", "templates", "recurring",
      "notifications", "sharing", "analytics", "meta",
    ],
    features: {
      aeiou_origin: true,
      operational_snapshot: true,
      risk_of_delay: true,
      recurring_crud: true,
      template_crud: true,
      notification_preferences: true,
      attachment_upload: true,
    },
    envelope: { source: "soma", fields: ["source", "generated_at", "open_url", "warnings"] },
    error_codes: [
      "PERMISSION_DENIED", "NOT_FOUND", "VALIDATION", "PLAN_LIMIT",
      "DB_ERROR", "AUTH_EXPIRED", "TIMEOUT", "PARTIAL_RESULT", "UNSUPPORTED",
    ],
  }),
});
