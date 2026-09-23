import { supabase } from "@/integrations/supabase/client";

/**
 * Leitura através da camada de cache compartilhado (Redis, via edge function).
 *
 * Regra de ouro: nunca quebrar a tela. Se a função de cache demorar, falhar ou
 * não estiver configurada, caímos automaticamente na consulta direta ao banco.
 */

const CACHE_TIMEOUT_MS = 600;
/** Demandas passam por lock/espera na função; damos mais folga antes de desistir. */
const DEMANDS_TIMEOUT_MS = 1200;

/** Depois de N falhas seguidas, paramos de tentar por um tempo. */
let consecutiveFailures = 0;
let disabledUntil = 0;
const FAILURE_THRESHOLD = 2;
const DISABLE_WINDOW_MS = 120_000;

function cacheAvailable(): boolean {
  return Date.now() >= disabledUntil;
}

function registerFailure() {
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    disabledUntil = Date.now() + DISABLE_WINDOW_MS;
    consecutiveFailures = 0;
  }
}

function registerSuccess() {
  consecutiveFailures = 0;
}

export type CacheResource = "services" | "profiles" | "board_statuses" | "demands";

interface CacheReadPayload {
  resource: CacheResource;
  boardId?: string;
  userIds?: string[];
}

/** As demandas têm função própria (chave versionada pelo banco). */
function functionNameFor(resource: CacheResource): string {
  return resource === "demands" ? "demands-read" : "cache-read";
}

function payloadKey(payload: CacheReadPayload): string {
  return [payload.resource, payload.boardId ?? "-", (payload.userIds ?? []).join(",")].join("|");
}

/** Pedidos idênticos em andamento são reaproveitados (coalescência no cliente). */
const inFlight = new Map<string, Promise<unknown[] | null>>();

/** Pequeno atraso aleatório para não disparar tudo ao mesmo tempo após invalidação. */
function jitter(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.random() * 250));
}

async function invokeWithTimeout<T>(payload: CacheReadPayload): Promise<T[] | null> {
  const limit = payload.resource === "demands" ? DEMANDS_TIMEOUT_MS : CACHE_TIMEOUT_MS;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), limit));

  const { resource, ...rest } = payload;
  const body = resource === "demands" ? rest : payload;

  const request = supabase.functions
    .invoke(functionNameFor(resource), { body })
    .then(({ data, error }) => {
      if (error || !data || !Array.isArray((data as any).data)) return null;
      return (data as any).data as T[];
    })
    .catch(() => null);

  return await Promise.race([request, timeout]);
}

/**
 * Busca `resource` no cache compartilhado; em qualquer problema usa `fallback`.
 */
export async function cachedRead<T>(
  payload: CacheReadPayload,
  fallback: () => Promise<T[]>,
): Promise<T[]> {
  if (!cacheAvailable()) return fallback();

  // Sem sessão ativa a função de cache responderia 401: vai direto ao banco.
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.access_token) return fallback();

  const key = payloadKey(payload);
  const existing = inFlight.get(key);

  const pending =
    existing ??
    (async () => {
      await jitter();
      return await invokeWithTimeout<T>(payload);
    })();

  if (!existing) {
    inFlight.set(key, pending as Promise<unknown[] | null>);
    pending.finally(() => {
      if (inFlight.get(key) === (pending as Promise<unknown[] | null>)) inFlight.delete(key);
    });
  }

  const result = (await pending) as T[] | null;

  if (result === null) {
    registerFailure();
    return fallback();
  }

  registerSuccess();
  return result;
}

/** Limpa a cópia guardada de um recurso que acabou de ser alterado. */
export async function invalidateServerCache(payload: CacheReadPayload): Promise<void> {
  try {
    await supabase.functions.invoke("cache-invalidate", { body: payload });
  } catch {
    // Silencioso de propósito: o TTL cuida da expiração de qualquer forma.
  }
}
