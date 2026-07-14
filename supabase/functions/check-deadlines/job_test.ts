import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  runDeadlineReminderJob,
  type ChannelResult,
  type DeadlineReminderJobDependencies,
} from "./job.ts";
import type {
  DeadlineReminder,
  DeliveryChannel,
  DeliveryStatus,
  NotificationPreferences,
  UserProfile,
} from "./lib.ts";

function buildDependencies(overrides: Partial<DeadlineReminderJobDependencies> = {}) {
  const claimed = new Set<string>();
  const calls: Array<{ channel: DeliveryChannel; userId: string; eventKey: string }> = [];
  const marked: Array<{
    channel: DeliveryChannel;
    userId: string;
    status: DeliveryStatus;
    error?: string;
  }> = [];

  const success = async (): Promise<ChannelResult> => ({ status: "sent" });

  const dependencies: DeadlineReminderJobDependencies = {
    listDemandsDueBetween: async () => [
      {
        id: "demand-1",
        title: "Preparar apresentação",
        due_date: "2026-07-15T18:00:00.000Z",
        assigned_to: "legacy-user",
      },
    ],
    listOverdueDemands: async () => [],
    listAssignees: async () => [
      { demand_id: "demand-1", user_id: "responsible", is_primary: true },
      { demand_id: "demand-1", user_id: "companion", is_primary: false },
    ],
    listPreferences: async () => new Map<string, NotificationPreferences>(),
    listProfiles: async () => new Map<string, UserProfile>([
      ["responsible", { id: "responsible", full_name: "Responsável", email: "r@example.com" }],
      ["companion", { id: "companion", full_name: "Acompanhante", email: "a@example.com" }],
    ]),
    claimDelivery: async (eventKey, _eventType, _demandId, userId, channel) => {
      const key = `${eventKey}:${userId}:${channel}`;
      if (claimed.has(key)) return false;
      claimed.add(key);
      calls.push({ channel, userId, eventKey });
      return true;
    },
    markDelivery: async (_eventKey, userId, channel, status, error) => {
      marked.push({ channel, userId, status, error });
    },
    createInAppNotification: success,
    sendEmail: success,
    sendPush: success,
    ...overrides,
  };

  return { dependencies, calls, marked };
}

const options = {
  now: new Date("2026-07-14T12:00:00.000Z"),
  timeZone: "America/Recife",
  appUrl: "https://pla.soma.lefil.com.br",
};

Deno.test("job sends in-app, email and FCM to responsible and companion only", async () => {
  const { dependencies, calls, marked } = buildDependencies();
  const result = await runDeadlineReminderJob(dependencies, options);

  assertEquals(result.dayBeforeDemandsChecked, 1);
  assertEquals(result.overdueDemandsChecked, 0);
  assertEquals(result.recipientsChecked, 2);
  assertEquals(result.sent, { in_app: 2, email: 2, push: 2 });
  assertEquals(calls.length, 6);
  assertEquals(new Set(calls.map((call) => call.userId)), new Set(["responsible", "companion"]));
  assertEquals(calls.some((call) => call.userId === "legacy-user"), false);
  assertEquals(marked.every((entry) => entry.status === "sent"), true);
});

Deno.test("job is idempotent when delivery claims already exist", async () => {
  const { dependencies, calls } = buildDependencies();
  const first = await runDeadlineReminderJob(dependencies, options);
  const second = await runDeadlineReminderJob(dependencies, options);

  assertEquals(first.sent, { in_app: 2, email: 2, push: 2 });
  assertEquals(second.sent, { in_app: 0, email: 0, push: 0 });
  assertEquals(second.duplicateClaims, 6);
  assertEquals(calls.length, 6);
});

Deno.test("job records disabled channels as skipped", async () => {
  const preferences = new Map<string, NotificationPreferences>([
    ["responsible", { emailNotifications: true, pushNotifications: false, deadlineReminders: true }],
    ["companion", { deadlineReminders: false }],
  ]);
  const { dependencies, marked } = buildDependencies({ listPreferences: async () => preferences });
  const result = await runDeadlineReminderJob(dependencies, options);

  assertEquals(result.sent, { in_app: 0, email: 1, push: 0 });
  assertEquals(result.skipped, { in_app: 2, email: 1, push: 2 });
  assertEquals(marked.filter((entry) => entry.status === "skipped").length, 5);
});

Deno.test("job marks a channel failed without blocking the other channels", async () => {
  const { dependencies, marked } = buildDependencies({
    sendEmail: async (reminder: DeadlineReminder) => {
      if (reminder.userId === "responsible") throw new Error("Resend unavailable");
      return { status: "sent" };
    },
  });
  const result = await runDeadlineReminderJob(dependencies, options);

  assertEquals(result.failed.email, 1);
  assertEquals(result.sent.in_app, 2);
  assertEquals(result.sent.push, 2);
  assertEquals(
    marked.some((entry) => entry.status === "failed" && entry.error === "Resend unavailable"),
    true,
  );
});

Deno.test("job preserves daily overdue in-app and FCM alerts without overdue email", async () => {
  const { dependencies, calls } = buildDependencies({
    listDemandsDueBetween: async () => [],
    listOverdueDemands: async () => [
      {
        id: "demand-1",
        title: "Preparar apresentação",
        due_date: "2026-07-10T18:00:00.000Z",
      },
    ],
  });
  const result = await runDeadlineReminderJob(dependencies, options);

  assertEquals(result.dayBeforeDemandsChecked, 0);
  assertEquals(result.overdueDemandsChecked, 1);
  assertEquals(result.sent, { in_app: 2, email: 0, push: 2 });
  assertEquals(result.skipped.email, 2);
  assertEquals(calls.filter((call) => call.eventKey.startsWith("deadline_overdue:")).length, 6);
});
