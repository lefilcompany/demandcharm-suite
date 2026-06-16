import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const auditedFiles = [
  "src/hooks/useBoardStatuses.ts",
  "src/hooks/useBoardTimeEntries.ts",
  "src/hooks/useDemands.ts",
  "src/hooks/useNotes.ts",
  "src/hooks/useNotifications.ts",
  "src/hooks/useRealtimeDemandDetail.ts",
  "src/hooks/useRealtimeDemands.ts",
  "src/hooks/useUserTimeTracking.ts",
];

describe("postgres realtime channel audit", () => {
  it.each(auditedFiles)("uses per-instance channel names in %s", (filePath) => {
    const content = readFileSync(resolve(filePath), "utf8");
    const channelCalls = [...content.matchAll(/\.channel\(([^\n]+)\)/g)].map((match) => match[1]);

    expect(content).toContain("createRealtimeInstanceId");
    expect(channelCalls.length).toBeGreaterThan(0);

    for (const channelCall of channelCalls) {
      expect(channelCall).toContain("current");
    }
  });
});