/**
 * Standard MCP response envelope for SoMA+ (see SoMA+ descritivo §20 and §24).
 * Every tool returns { content:[text], structuredContent:{ source, generated_at, open_url?, warnings, ...payload } }.
 */

import type { ToolContext } from "@lovable.dev/mcp-js";

export type EnvelopeExtras = {
  open_url?: string | null;
  warnings?: string[];
};

function envelope(payload: Record<string, unknown>, extras: EnvelopeExtras = {}) {
  return {
    source: "soma" as const,
    generated_at: new Date().toISOString(),
    open_url: extras.open_url ?? null,
    warnings: extras.warnings ?? [],
    ...payload,
  };
}

export function ok(payload: Record<string, unknown>, extras: EnvelopeExtras = {}) {
  const data = envelope(payload, extras);
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

export function okList<T>(key: string, items: T[], extras: EnvelopeExtras = {}) {
  return ok({ [key]: items, count: items.length }, extras);
}

export function okCreated(payload: Record<string, unknown>, extras: EnvelopeExtras = {}) {
  return ok({ success: true, operation: "create", ...payload }, extras);
}

export function okUpdated(payload: Record<string, unknown>, extras: EnvelopeExtras = {}) {
  return ok({ success: true, operation: "update", ...payload }, extras);
}

export function okDeleted(id: string, extras: EnvelopeExtras = {}) {
  return ok({ success: true, operation: "delete", deleted_id: id }, extras);
}

export type ErrorCode =
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "VALIDATION"
  | "PLAN_LIMIT"
  | "DB_ERROR"
  | "AUTH_EXPIRED"
  | "TIMEOUT"
  | "PARTIAL_RESULT"
  | "UNSUPPORTED";

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  PERMISSION_DENIED: "Você não tem permissão para esta ação neste contexto.",
  NOT_FOUND: "O recurso não existe mais ou não está visível para sua conta.",
  VALIDATION: "Uma informação está inválida ou incompleta.",
  PLAN_LIMIT: "O limite do plano ou do quadro foi atingido.",
  DB_ERROR: "O SoMA+ não conseguiu concluir a operação.",
  AUTH_EXPIRED: "A conexão precisa ser renovada.",
  TIMEOUT: "A resposta demorou mais que o esperado.",
  PARTIAL_RESULT: "Parte das ações foi concluída.",
  UNSUPPORTED: "Esta operação ainda não está disponível pelo MCP.",
};

const DEFAULT_RECOVERY: Record<ErrorCode, string[]> = {
  PERMISSION_DENIED: ["Criar uma solicitação", "Escolher outro quadro", "Pedir acesso ao administrador"],
  NOT_FOUND: ["Pesquisar novamente", "Atualizar o vínculo do projeto"],
  VALIDATION: ["Revisar os campos informados"],
  PLAN_LIMIT: ["Arquivar recursos", "Ajustar plano", "Escolher outro quadro"],
  DB_ERROR: ["Tentar novamente em instantes"],
  AUTH_EXPIRED: ["Reconectar a integração"],
  TIMEOUT: ["Consultar o resultado antes de repetir"],
  PARTIAL_RESULT: ["Retomar apenas as ações que falharam"],
  UNSUPPORTED: ["Usar a interface do SoMA+"],
};

export function err(code: ErrorCode, detail?: string, extras?: { recovery?: string[]; hint?: string }) {
  const payload = {
    success: false as const,
    error_code: code,
    user_message: DEFAULT_MESSAGES[code],
    detail: detail ?? null,
    recovery_options: extras?.recovery ?? DEFAULT_RECOVERY[code],
    hint: extras?.hint ?? null,
    source: "soma" as const,
    generated_at: new Date().toISOString(),
  };
  return {
    content: [{ type: "text" as const, text: `${code}: ${detail ?? DEFAULT_MESSAGES[code]}` }],
    structuredContent: payload,
    isError: true as const,
  };
}

export function fromPgError(e: { message?: string; code?: string; details?: string } | null | undefined) {
  if (!e) return err("DB_ERROR", "Unknown error");
  const msg = e.message ?? "Database error";
  if (msg.startsWith("PLAN_LIMIT_")) return err("PLAN_LIMIT", msg);
  if (e.code === "42501" || /permission denied|row-level security/i.test(msg)) return err("PERMISSION_DENIED", msg);
  if (e.code === "PGRST116" || /not found|no rows/i.test(msg)) return err("NOT_FOUND", msg);
  if (e.code === "23505") return err("VALIDATION", msg, { recovery: ["Usar um valor único"] });
  if (e.code === "23503") return err("VALIDATION", msg, { recovery: ["Verificar referências"] });
  return err("DB_ERROR", msg);
}

export function requireAuth(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) return err("AUTH_EXPIRED", "Not authenticated");
  return null;
}
