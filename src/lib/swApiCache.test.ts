import { describe, expect, it } from "vitest";
import { apiCacheSubject, isSupabaseRestRead, userScopedCacheKey } from "./swApiCache";

function jwt(payload: Record<string, unknown>) {
  const b64 = (s: string) => Buffer.from(s).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(JSON.stringify(payload))}.sig`;
}

describe("apiCacheSubject", () => {
  it("returns the user id for an authenticated token", () => {
    const header = `Bearer ${jwt({ sub: "aa5aad1c-c89f-4b24-8c95-775aa9d88441", role: "authenticated" })}`;
    expect(apiCacheSubject(header)).toBe("aa5aad1c-c89f-4b24-8c95-775aa9d88441");
  });

  it("never caches anonymous requests (they return empty lists)", () => {
    expect(apiCacheSubject(`Bearer ${jwt({ role: "anon", iss: "supabase" })}`)).toBeNull();
    expect(apiCacheSubject(`Bearer ${jwt({ sub: "", role: "authenticated" })}`)).toBeNull();
  });

  it("ignores missing or malformed headers", () => {
    expect(apiCacheSubject(null)).toBeNull();
    expect(apiCacheSubject(undefined)).toBeNull();
    expect(apiCacheSubject("Bearer not-a-jwt")).toBeNull();
    expect(apiCacheSubject("Basic abc")).toBeNull();
  });
});

describe("isSupabaseRestRead", () => {
  it("matches only data reads, never auth or functions", () => {
    expect(isSupabaseRestRead(new URL("https://abc.supabase.co/rest/v1/projects?select=*"))).toBe(true);
    expect(isSupabaseRestRead(new URL("https://abc.supabase.co/auth/v1/user"))).toBe(false);
    expect(isSupabaseRestRead(new URL("https://abc.supabase.co/functions/v1/demands-read"))).toBe(false);
    expect(isSupabaseRestRead(new URL("https://abc.supabase.co/storage/v1/object/x"))).toBe(false);
    expect(isSupabaseRestRead(new URL("https://example.com/rest/v1/projects"))).toBe(false);
  });
});

describe("userScopedCacheKey", () => {
  it("gives two users different keys for the same URL", () => {
    const url = "https://abc.supabase.co/rest/v1/projects?select=*&team_id=eq.1";
    const a = userScopedCacheKey(url, "user-a");
    const b = userScopedCacheKey(url, "user-b");
    expect(a).not.toBe(b);
    expect(a).toContain("__soma_user=user-a");
    expect(new URL(a).searchParams.get("team_id")).toBe("eq.1");
  });
});
