import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runDeadlineReminderJob, type DeadlineReminderJobDependencies } from "./job.ts";
import type {
  DeadlineReminder,
  DeliveryChannel,
  DeliveryStatus,
  NotificationPreferences,
  UserProfile,
} from "./lib.ts";

Deno.test("e2e: complete deadline workflow routes each event once to the correct allocated users", async () => {
  const delivered = new Set<string>();
  const channelCalls: Array<{
    channel: DeliveryChannel;
    userId: string;
    eventType: DeadlineReminder["eventType"];
  }> = [];
  const finalStatuses = new Map<string, DeliveryStatus>();

  const preferences = new Map<string, NotificationPreferences>([
    ["responsible", { deadlineReminders: true, emailNotifications: true, pushNotifications: true }],
    ["companion", { deadlineReminders: true, emailNotifications: false, pushNotifications: true }],
  ]);
  const profiles = new Map<string, UserProfile>([
    ["responsible", { id: "responsible", full_name: "Responsável", email: "responsible@example.com" }],
    ["companion", { id: "companion", full_name: "Acompanhante", email: "companion@example.com" }],
  ]);

  const dependencies: DeadlineReminderJobDependencies = {
    listDemandsDueBetween: async () => [{
      id: "tomorrow-demand",
      title: "Entrega de campanha",
      due_date: "2026-07-15T18:00:00.000Z",
      assigned_to: "legacy-user",
    }],
    listOverdueDemands: async () => [{
      id: "overdue-demand",
      title: "Relatório atrasado",
      due_date: "2026-07-10T18:00:00.000Z",
      assigned_to: "responsible",
    }],
    listAssignees: async () => [
      { demand_id: "tomorrow-demand", user_id: "responsible", is_primary: true },
      { demand_id: "tomorrow-demand", user_id: "companion", is_primary: false },
      { demand_id: "overdue-demand", user_id: "responsible", is_primary: true },
    ],
    listPreferences: async () => preferences,
    listProfiles: async () => profiles,
    claimDelivery: async (eventKey, _eventType, _demandId, userId, channel) => {
      const id = `${eventKey}:${userId}:${channel}`;
      if (delivered.has(id)) return false;
      delivered.add(id);
      return true;
    },
    markDelivery: async (eventKey, userId, channel, status) => {
      finalStatuses.set(`${eventKey}:${userId}:${channel}`, status);
    },
    createInAppNotification: async (reminder) => {
      channelCalls.push({ channel: "in_app", userId: reminder.userId, eventType: reminder.eventType });
      return { status: "sent" };
    },
    sendEmail: async (reminder) => {
      channelCalls.push({ channel: "email", userId: reminder.userId, eventType: reminder.eventType });
      return { status: "sent" };
    },
    sendPush: async (reminder) => {
      channelCalls.push({ channel: "push", userId: reminder.userId, eventType: reminder.eventType });
      return { status: "sent" };
    },
  };

  const options = {
    now: new Date("2026-07-14T12:00:00.000Z"),
    timeZone: "America/Recife",
    appUrl: "https://pla.soma.lefil.com.br",
  };

  const first = await runDeadlineReminderJob(dependencies, options);
  const second = await runDeadlineReminderJob(dependencies, options);

  assertEquals(first.dayBeforeDemandsChecked, 1);
  assertEquals(first.overdueDemandsChecked, 1);
  assertEquals(first.recipientsChecked, 3);
  assertEquals(first.sent, { in_app: 3, email: 1, push: 3 });
  assertEquals(first.skipped.email, 2);
  assertEquals(second.sent, { in_app: 0, email: 0, push: 0 });
  assertEquals(second.duplicateClaims, 9);

  assertEquals(channelCalls.some((call) => call.userId === "legacy-user"), false);
  assertEquals(
    channelCalls.filter((call) => call.eventType === "deadline_day_before" && call.channel === "email").length,
    1,
  );
  assertEquals(
    channelCalls.filter((call) => call.eventType === "deadline_overdue" && call.channel === "email").length,
    0,
  );
  assertEquals([...finalStatuses.values()].filter((status) => status === "failed").length, 0);
});
