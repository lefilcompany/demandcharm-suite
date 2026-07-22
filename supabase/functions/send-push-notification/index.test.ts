import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyFcmError, normalizeLink } from "./index.ts";

Deno.test("normalizeLink resolves relative paths against APP_URL", () => {
  const out = normalizeLink("/demands/123", "https://app.example.com");
  assertEquals(out, "https://app.example.com/demands/123");
});

Deno.test("normalizeLink falls back on external origin", () => {
  const out = normalizeLink("https://evil.example.com/x", "https://app.example.com");
  assertEquals(out, "https://app.example.com/");
});

Deno.test("normalizeLink rejects non-http protocols", () => {
  const out = normalizeLink("javascript:alert(1)", "https://app.example.com");
  assertEquals(out, "https://app.example.com/");
});

Deno.test("normalizeLink accepts http on localhost", () => {
  const out = normalizeLink("/x", "http://localhost:3000");
  assertEquals(out, "http://localhost:3000/x");
});

Deno.test("classifyFcmError flags UNREGISTERED for removal", () => {
  const r = classifyFcmError(
    { error: { details: [{ errorCode: "UNREGISTERED" }] } },
    404,
  );
  assertEquals(r.removeToken, true);
  assertEquals(r.code, "UNREGISTERED");
});

Deno.test("classifyFcmError removes token only for token field violation", () => {
  const r = classifyFcmError(
    {
      error: {
        details: [
          {
            errorCode: "INVALID_ARGUMENT",
            fieldViolations: [{ field: "message.token", description: "bad" }],
          },
        ],
      },
    },
    400,
  );
  assertEquals(r.removeToken, true);
  assertEquals(r.code, "INVALID_TOKEN");
});

Deno.test("classifyFcmError keeps token on generic INVALID_ARGUMENT", () => {
  const r = classifyFcmError(
    {
      error: {
        details: [
          {
            errorCode: "INVALID_ARGUMENT",
            fieldViolations: [{ field: "message.notification.title", description: "bad" }],
          },
        ],
      },
    },
    400,
  );
  assertEquals(r.removeToken, false);
});

Deno.test("classifyFcmError never removes on SENDER_ID_MISMATCH", () => {
  const r = classifyFcmError(
    { error: { details: [{ errorCode: "SENDER_ID_MISMATCH" }] } },
    403,
  );
  assertEquals(r.removeToken, false);
  assertEquals(r.code, "SENDER_ID_MISMATCH");
});
