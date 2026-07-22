import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  addDaysToDateKey,
  buildAssigneeMap,
  buildDeadlineReminder,
  buildOverdueReminder,
  formatDateKeyInTimeZone,
  getDemandRecipientIds,
  getEnabledDeliveryChannels,
  getTomorrowUtcWindow,
  isAuthorized,
  normalizeAppUrl,
  zonedStartOfDayToUtc,
} from "./lib.ts";

Deno.test("isAuthorized accepts CRON_SECRET, CRON_TOKEN, or either", () => {
  // Legacy single-secret behavior
  assertEquals(isAuthorized("Bearer secret", "secret"), true);
  assertEquals(isAuthorized("Bearer wrong", "secret"), false);
  assertEquals(isAuthorized(null, "secret"), false);
  assertEquals(isAuthorized("Bearer secret", undefined), false);

  // Dual-secret behavior (CRON_SECRET fallback + Vault-managed CRON_TOKEN)
  assertEquals(isAuthorized("Bearer secret", "secret", "token"), true);
  assertEquals(isAuthorized("Bearer token", "secret", "token"), true);
  assertEquals(isAuthorized("Bearer token", null, "token"), true);
  assertEquals(isAuthorized("Bearer secret", "secret", null), true);
  assertEquals(isAuthorized("Bearer other", "secret", "token"), false);
  assertEquals(isAuthorized("Bearer ", "secret", "token"), false);
  assertEquals(isAuthorized("secret", "secret", "token"), false);
  assertEquals(isAuthorized(undefined, "secret", "token"), false);
  assertEquals(isAuthorized("Bearer x", "", ""), false);
});

Deno.test("calendar helpers calculate tomorrow in America/Recife", () => {
  const now = new Date("2026-07-14T20:00:00.000Z");
  assertEquals(formatDateKeyInTimeZone(now, "America/Recife"), "2026-07-14");
  assertEquals(addDaysToDateKey("2026-07-14", 1), "2026-07-15");

  const window = getTomorrowUtcWindow(now, "America/Recife");
  assertEquals(window.dateKey, "2026-07-15");
  assertEquals(window.start.toISOString(), "2026-07-15T03:00:00.000Z");
  assertEquals(window.end.toISOString(), "2026-07-16T03:00:00.000Z");
});

Deno.test("zonedStartOfDayToUtc handles a DST timezone", () => {
  assertEquals(
    zonedStartOfDayToUtc("2026-01-15", "America/New_York").toISOString(),
    "2026-01-15T05:00:00.000Z",
  );
  assertEquals(
    zonedStartOfDayToUtc("2026-07-15", "America/New_York").toISOString(),
    "2026-07-15T04:00:00.000Z",
  );
});

Deno.test("recipient selection includes only allocated users and excludes creator implicitly", () => {
  const demand = {
    id: "demand-1",
    title: "Demand",
    due_date: "2026-07-15T18:00:00.000Z",
    assigned_to: "legacy-primary",
  };
  const map = buildAssigneeMap([
    { demand_id: "demand-1", user_id: "primary", is_primary: true },
    { demand_id: "demand-1", user_id: "companion", is_primary: false },
    { demand_id: "demand-1", user_id: "companion", is_primary: false },
  ]);

  assertEquals(getDemandRecipientIds(demand, map), ["primary", "companion"]);
});

Deno.test("recipient selection falls back to assigned_to for legacy demands", () => {
  const demand = {
    id: "legacy-demand",
    title: "Legacy",
    due_date: "2026-07-15T18:00:00.000Z",
    assigned_to: "legacy-primary",
  };

  assertEquals(getDemandRecipientIds(demand, new Map()), ["legacy-primary"]);
});

Deno.test("delivery channels respect global, deadline and reminder-type preferences", () => {
  assertEquals(getEnabledDeliveryChannels(undefined), ["in_app", "push", "email"]);
  assertEquals(
    getEnabledDeliveryChannels({ pushNotifications: false, emailNotifications: true }),
    ["email"],
  );
  assertEquals(getEnabledDeliveryChannels({ deadlineReminders: false }), []);
  assertEquals(getEnabledDeliveryChannels(undefined, "overdue"), ["in_app", "push"]);
});

Deno.test("buildDeadlineReminder produces deterministic copy and event key", () => {
  const reminder = buildDeadlineReminder(
    {
      id: "demand-1",
      title: "Finalizar relatório",
      due_date: "2026-07-15T18:00:00.000Z",
    },
    "user-1",
    "2026-07-15",
    "https://pla.soma.lefil.com.br/path-that-is-ignored",
    "Maria",
  );

  assertEquals(reminder.eventKey, "deadline_day_before:demand-1:2026-07-15");
  assertEquals(reminder.link, "/demands/demand-1");
  assertEquals(reminder.actionUrl, "https://pla.soma.lefil.com.br/demands/demand-1");
  assertEquals(reminder.userName, "Maria");
  assertEquals(reminder.message.includes("vence amanhã (15/07/2026)"), true);
});

Deno.test("normalizeAppUrl only accepts HTTPS origins", () => {
  assertEquals(normalizeAppUrl("http://unsafe.example.com"), "https://pla.soma.lefil.com.br");
  assertEquals(normalizeAppUrl("https://example.com/path"), "https://example.com");
  assertEquals(normalizeAppUrl("not-a-url"), "https://pla.soma.lefil.com.br");
});

Deno.test("buildOverdueReminder preserves daily overdue alerts without email", () => {
  const reminder = buildOverdueReminder(
    { id: "demand-2", title: "Entregar peças", due_date: "2026-07-10T18:00:00.000Z" },
    "user-1",
    "2026-07-10",
    "2026-07-14",
    "https://pla.soma.lefil.com.br",
  );
  assertEquals(reminder.eventKey, "deadline_overdue:demand-2:2026-07-14");
  assertEquals(reminder.eventType, "deadline_overdue");
  assertEquals(reminder.severity, "error");
  assertEquals(reminder.message.includes("venceu em 10/07/2026"), true);
});
