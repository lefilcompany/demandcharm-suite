// Prevent the module from starting its HTTP server during tests.
Deno.env.set("SKIP_SERVE", "1");

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handler } from "./index.ts";

const SECRET = "test-cron-secret-abc123";

function setEnv() {
  Deno.env.set("CRON_SECRET", SECRET);
  // SUPABASE_URL / SERVICE_ROLE_KEY are not exercised in 401 paths.
  Deno.env.set("SUPABASE_URL", "http://localhost");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub");
}

Deno.test("handler: returns 401 when no Authorization header", async () => {
  setEnv();
  const res = await handler(new Request("http://localhost/", { method: "POST" }));
  await res.text();
  assertEquals(res.status, 401);
});

Deno.test("handler: returns 401 when bearer is wrong", async () => {
  setEnv();
  const res = await handler(
    new Request("http://localhost/", {
      method: "POST",
      headers: { Authorization: "Bearer wrong" },
    }),
  );
  await res.text();
  assertEquals(res.status, 401);
});

Deno.test("handler: returns 204-style 200 on OPTIONS preflight", async () => {
  setEnv();
  const res = await handler(new Request("http://localhost/", { method: "OPTIONS" }));
  await res.text();
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});
