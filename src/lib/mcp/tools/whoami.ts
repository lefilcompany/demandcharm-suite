import { defineTool } from "@lovable.dev/mcp-js";

export const whoamiTool = defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Return the signed-in SoMA user's id and email from the verified OAuth token.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text" as const, text: "PERMISSION_DENIED: Not authenticated" }], isError: true as const };
    }
    const payload = { user_id: ctx.getUserId(), email: ctx.getUserEmail() };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
