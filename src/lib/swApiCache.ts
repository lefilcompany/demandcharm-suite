/**
 * Regras da cópia offline das leituras do backend (usadas pelo service worker).
 *
 * Só leituras de dados (`/rest/v1/`) feitas por um usuário autenticado podem ser
 * guardadas, e cada cópia é separada por usuário: a chave do cache carrega o `sub`
 * do token. Assim uma resposta nunca é entregue a outra conta no mesmo navegador,
 * e pedidos anônimos (que o banco responde com lista vazia) não são guardados.
 */

const REST_PREFIX = "/rest/v1/";

/** Decodifica o payload de um JWT sem validar assinatura (só para extrair o `sub`). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  try {
    const parsed = JSON.parse(atob(padded));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Identificador do usuário dono da requisição, lido do cabeçalho Authorization.
 * Retorna `null` para pedidos sem token, com token anônimo ou ilegível — esses
 * pedidos nunca devem ser guardados nem atendidos a partir de cópia.
 */
export function apiCacheSubject(authorizationHeader: string | null | undefined): string | null {
  if (!authorizationHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  if (!match) return null;
  const payload = decodeJwtPayload(match[1]);
  if (!payload) return null;
  if (payload.role === "anon" || payload.role === "service_role") return null;
  const sub = payload.sub;
  if (typeof sub !== "string" || sub.length === 0) return null;
  return sub;
}

/** Verdadeiro para leituras de dados do backend (tabelas/RPC via REST). */
export function isSupabaseRestRead(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  if (!/\.supabase\.(co|in)$/i.test(url.hostname)) return false;
  return url.pathname.startsWith(REST_PREFIX);
}

/** Chave de cache separada por usuário para a mesma URL. */
export function userScopedCacheKey(requestUrl: string, subject: string): string {
  const url = new URL(requestUrl);
  url.searchParams.set("__soma_user", subject);
  return url.toString();
}
