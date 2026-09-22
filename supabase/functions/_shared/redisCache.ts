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

async function redisCommand(command: unknown[]): Promise<unknown> {
  if (!isRedisConfigured()) return null;

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
      return null;
    }

    const json = await res.json();
    return json?.result ?? null;
  } catch (error) {
    console.warn("[redisCache] erro de rede", String(error));
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
