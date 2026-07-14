import {
  buildAssigneeMap,
  buildDayBeforeReminder,
  buildOverdueReminder,
  type DeadlineDemand,
  type DeadlineReminder,
  type DeliveryChannel,
  type DeliveryStatus,
  type DemandAssignee,
  formatDateKeyInTimeZone,
  getDemandRecipientIds,
  getEnabledDeliveryChannels,
  getTomorrowUtcWindow,
  type NotificationPreferences,
  type ReminderKind,
  type UserProfile,
} from "./lib.ts";

export interface ChannelResult {
  status: Exclude<DeliveryStatus, "failed">;
  reason?: string;
}

export interface DeadlineReminderJobDependencies {
  listDemandsDueBetween(start: Date, end: Date): Promise<DeadlineDemand[]>;
  listOverdueDemands(before: Date): Promise<DeadlineDemand[]>;
  listAssignees(demandIds: string[]): Promise<DemandAssignee[]>;
  listPreferences(userIds: string[]): Promise<Map<string, NotificationPreferences>>;
  listProfiles(userIds: string[]): Promise<Map<string, UserProfile>>;
  claimDelivery(
    eventKey: string,
    eventType: DeadlineReminder["eventType"],
    demandId: string,
    userId: string,
    channel: DeliveryChannel,
  ): Promise<boolean>;
  markDelivery(
    eventKey: string,
    userId: string,
    channel: DeliveryChannel,
    status: DeliveryStatus,
    error?: string,
  ): Promise<void>;
  createInAppNotification(reminder: DeadlineReminder): Promise<ChannelResult>;
  sendEmail(reminder: DeadlineReminder, profile?: UserProfile): Promise<ChannelResult>;
  sendPush(reminder: DeadlineReminder): Promise<ChannelResult>;
}

export interface DeadlineReminderJobOptions {
  now?: Date;
  timeZone: string;
  appUrl: string;
}

export interface DeadlineReminderJobResult {
  notificationDateKey: string;
  dueDateKey: string;
  demandsChecked: number;
  dayBeforeDemandsChecked: number;
  overdueDemandsChecked: number;
  recipientsChecked: number;
  sent: Record<DeliveryChannel, number>;
  skipped: Record<DeliveryChannel, number>;
  failed: Record<DeliveryChannel, number>;
  duplicateClaims: number;
}

interface ReminderCandidate {
  demand: DeadlineDemand;
  kind: ReminderKind;
  dueDateKey: string;
}

const ALL_CHANNELS: DeliveryChannel[] = ["in_app", "email", "push"];

function emptyChannelCounts(): Record<DeliveryChannel, number> {
  return { in_app: 0, email: 0, push: 0 };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000);
}

export async function runDeadlineReminderJob(
  dependencies: DeadlineReminderJobDependencies,
  options: DeadlineReminderJobOptions,
): Promise<DeadlineReminderJobResult> {
  const now = options.now ?? new Date();
  const tomorrowWindow = getTomorrowUtcWindow(now, options.timeZone);
  const notificationDateKey = formatDateKeyInTimeZone(now, options.timeZone);
  const [dayBeforeDemands, overdueDemands] = await Promise.all([
    dependencies.listDemandsDueBetween(tomorrowWindow.start, tomorrowWindow.end),
    dependencies.listOverdueDemands(now),
  ]);

  const candidates: ReminderCandidate[] = [
    ...dayBeforeDemands.map((demand) => ({
      demand,
      kind: "day_before" as const,
      dueDateKey: tomorrowWindow.dateKey,
    })),
    ...overdueDemands.map((demand) => ({
      demand,
      kind: "overdue" as const,
      dueDateKey: formatDateKeyInTimeZone(new Date(demand.due_date), options.timeZone),
    })),
  ];

  const result: DeadlineReminderJobResult = {
    notificationDateKey,
    dueDateKey: tomorrowWindow.dateKey,
    demandsChecked: candidates.length,
    dayBeforeDemandsChecked: dayBeforeDemands.length,
    overdueDemandsChecked: overdueDemands.length,
    recipientsChecked: 0,
    sent: emptyChannelCounts(),
    skipped: emptyChannelCounts(),
    failed: emptyChannelCounts(),
    duplicateClaims: 0,
  };

  if (candidates.length === 0) return result;

  const uniqueDemandIds = [...new Set(candidates.map(({ demand }) => demand.id))];
  const assignees = await dependencies.listAssignees(uniqueDemandIds);
  const assigneeMap = buildAssigneeMap(assignees);

  const recipientsByDemand = new Map<string, string[]>();
  const uniqueUserIds = new Set<string>();
  for (const { demand } of candidates) {
    const recipients = getDemandRecipientIds(demand, assigneeMap);
    recipientsByDemand.set(demand.id, recipients);
    recipients.forEach((userId) => uniqueUserIds.add(userId));
  }

  if (uniqueUserIds.size === 0) return result;

  const userIds = [...uniqueUserIds];
  const [preferencesByUser, profilesByUser] = await Promise.all([
    dependencies.listPreferences(userIds),
    dependencies.listProfiles(userIds),
  ]);

  for (const candidate of candidates) {
    const { demand, kind, dueDateKey } = candidate;
    const recipients = recipientsByDemand.get(demand.id) ?? [];

    for (const userId of recipients) {
      result.recipientsChecked += 1;
      const profile = profilesByUser.get(userId);
      const reminder = kind === "day_before"
        ? buildDayBeforeReminder(demand, userId, dueDateKey, options.appUrl, profile?.full_name)
        : buildOverdueReminder(
          demand,
          userId,
          dueDateKey,
          notificationDateKey,
          options.appUrl,
          profile?.full_name,
        );
      const enabledChannels = new Set(
        getEnabledDeliveryChannels(preferencesByUser.get(userId), reminder.kind),
      );

      for (const channel of ALL_CHANNELS) {
        const claimed = await dependencies.claimDelivery(
          reminder.eventKey,
          reminder.eventType,
          reminder.demandId,
          reminder.userId,
          channel,
        );

        if (!claimed) {
          result.duplicateClaims += 1;
          continue;
        }

        if (!enabledChannels.has(channel)) {
          await dependencies.markDelivery(
            reminder.eventKey,
            reminder.userId,
            channel,
            "skipped",
            reminder.kind === "overdue" && channel === "email"
              ? "Overdue emails are intentionally disabled"
              : "Disabled by notification preferences",
          );
          result.skipped[channel] += 1;
          continue;
        }

        try {
          let channelResult: ChannelResult;
          if (channel === "in_app") {
            channelResult = await dependencies.createInAppNotification(reminder);
          } else if (channel === "email") {
            channelResult = await dependencies.sendEmail(reminder, profile);
          } else {
            channelResult = await dependencies.sendPush(reminder);
          }

          await dependencies.markDelivery(
            reminder.eventKey,
            reminder.userId,
            channel,
            channelResult.status,
            channelResult.reason,
          );
          result[channelResult.status][channel] += 1;
        } catch (error) {
          const message = errorMessage(error);
          await dependencies.markDelivery(
            reminder.eventKey,
            reminder.userId,
            channel,
            "failed",
            message,
          );
          result.failed[channel] += 1;
        }
      }
    }
  }

  return result;
}
