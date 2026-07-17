export function buildCurl(opts: {
  endpoint: string;
  toolName: string;
  body: unknown;
  includeAuth?: boolean;
}) {
  const { endpoint, toolName, body, includeAuth = true } = opts;
  const lines = [
    `curl -X POST '${endpoint}/.mcp/invoke-tool/${toolName}' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H 'Accept: application/json, text/event-stream' \\`,
  ];
  if (includeAuth) lines.push(`  -H 'Authorization: Bearer <SEU_ACCESS_TOKEN_OAUTH>' \\`);
  lines.push(`  -d '${JSON.stringify(body)}'`);
  return lines.join("\n");
}
