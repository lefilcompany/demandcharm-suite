/**
 * Camada fina sobre o Upstash Redis (API REST).
 *
 * Tudo aqui é "best effort": se o Redis estiver indisponível ou os segredos
 * não estiverem configurados, as funções degradam silenciosamente e o chamador
 * segue consultando o banco normalmente.
 */

const REDIS_URL = Deno.env.get("UPSTASH_REDIS_REST_URL") ?? "";
const REDIS_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN") ?? "";

/** Prefixo de versão — incremente para invalidar todas as chaves de uma vez. */
export const CACHE_VERSION = "v1";

export function isRedisConfigured(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

/**
 * Circuit breaker local à instância: depois de N falhas seguidas do Redis
 * paramos de tentar por um tempo, para não somar latência a cada request.
 */
let consecutiveFailures = 0;
let disabledUntil = 0;
const FAILURE_THRESHOLD = 3;
const DISABLE_WINDOW_MS = 30_000;

export function redisDegraded(): boolean {
  return Date.now() < disabledUntil;
}

function registerFailure() {
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    disabledUntil = Date.now() + DISABLE_WINDOW_MS;
    consecutiveFailures = 0;
    console.warn("[redisCache] circuito aberto por", DISABLE_WINDOW_MS, "ms");
  }
}

function registerSuccess() {
  consecutiveFailures = 0;
}

async function redisCommand(command: unknown[]): Promise<unknown> {
  if (!isRedisConfigured() || redisDegraded()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const res = await fetch(REDIS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn("[redisCache] comando falhou", res.status, await res.text());
      registerFailure();
      return null;
    }

    const json = await res.json();
    registerSuccess();
    return json?.result ?? null;
  } catch (error) {
    console.warn("[redisCache] erro de rede", String(error));
    registerFailure();
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function cacheKey(parts: (string | number | null | undefined)[]): string {
  return [CACHE_VERSION, ...parts.filter((p) => p !== null && p !== undefined)].join(":");
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redisCommand(["GET", key]);
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await redisCommand(["SET", key, JSON.stringify(value), "EX", String(ttlSeconds)]);
}

/* ----------------------------------------------------------------------- */
/* Lock distribuído: só um pedido por vez refaz a consulta pesada no banco.  */
/* ----------------------------------------------------------------------- */

/** Tenta pegar o lock. `true` = ganhou e deve consultar o banco. */
export async function cacheAcquireLock(key: string, ttlSeconds = 10): Promise<boolean> {
  const result = await redisCommand(["SET", `lock:${key}`, "1", "NX", "EX", String(ttlSeconds)]);
  return result === "OK";
}

export async function cacheReleaseLock(key: string): Promise<void> {
  await redisCommand(["DEL", `lock:${key}`]);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Espera (polling curto) a chave aparecer, para o caso de outro pedido estar
 * refazendo a consulta neste exato momento.
 */
export async function cacheWaitFor<T>(
  key: string,
  maxWaitMs = 1500,
  intervalMs = 100,
): Promise<T | null> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const value = await cacheGet<T>(key);
    if (value) return value;
  }
  return null;
}

/* ----------------------------------------------------------------------- */
/* Cópia de segurança (stale): última resposta conhecida, com a versão junto. */
/* ----------------------------------------------------------------------- */

export interface StaleEntry<T> {
  version: number;
  data: T;
}

export async function cacheSetStale<T>(
  key: string,
  version: number,
  data: T,
  ttlSeconds = 600,
): Promise<void> {
  await cacheSet(key, { version, data } satisfies StaleEntry<T>, ttlSeconds);
}

/** Só devolve a cópia se a versão bater com a do banco (sem dado velho). */
export async function cacheGetStale<T>(key: string, version: number): Promise<T | null> {
  const entry = await cacheGet<StaleEntry<T>>(key);
  if (!entry || entry.version !== version) return null;
  return entry.data;
}

export async function cacheDelete(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await redisCommand(["DEL", ...keys]);
}

/** Apaga chaves por padrão (usa SCAN para não bloquear o Redis). */
export async function cacheDeletePattern(pattern: string): Promise<void> {
  if (!isRedisConfigured()) return;

  let cursor = "0";
  let iterations = 0;

  do {
    const result = (await redisCommand([
      "SCAN",
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      "200",
    ])) as [string, string[]] | null;

    if (!result) return;

    cursor = result[0];
    const keys = result[1] ?? [];
    if (keys.length > 0) await cacheDelete(keys);
    iterations += 1;
  } while (cursor !== "0" && iterations < 20);
}
