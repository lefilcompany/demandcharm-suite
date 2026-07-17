// Generate an example payload from a JSON Schema (draft-07 shape).
export function exampleFromSchema(schema: any): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return {};
  const props = schema.properties ?? {};
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries<any>(props)) {
    out[key] = exampleValue(key, def);
  }
  return out;
}

function exampleValue(name: string, def: any): unknown {
  if (!def) return null;
  if (Array.isArray(def.enum) && def.enum.length > 0) return def.enum[0];
  if (def.format === "uuid" || /_id$|^id$/.test(name)) return "00000000-0000-0000-0000-000000000000";
  switch (def.type) {
    case "integer":
    case "number":
      return def.minimum ?? (name.includes("limit") ? 10 : 1);
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return exampleFromSchema(def);
    case "string":
    default: {
      if (/date/i.test(name)) return new Date().toISOString().slice(0, 10);
      if (/email/i.test(name)) return "user@example.com";
      if (/title/i.test(name)) return "Nova demanda de teste";
      if (/description|content|body/i.test(name)) return "Descrição de exemplo";
      if (/name/i.test(name)) return "Exemplo";
      return "string";
    }
  }
}

export function exampleResponseFor(toolName: string): unknown {
  return {
    source: "soma",
    generated_at: new Date().toISOString(),
    open_url: `https://pla.soma.lefil.com.br/#${toolName}`,
    warnings: [],
    result: { ok: true, tool: toolName, note: "Resposta de exemplo — a resposta real virá do servidor MCP." },
  };
}
