import { describe, expect, it } from "vitest";
import { getPriorityScore } from "@/lib/priorityScore";

const baseDemand = {
  created_at: "2026-09-01T00:00:00.000Z",
  due_date: "2026-09-03T00:00:00.000Z",
  priority: "média",
  effort_points: 5,
};

describe("getPriorityScore", () => {
  it("recalculates when priority changes", () => {
    const medium = getPriorityScore(baseDemand);
    const urgent = getPriorityScore({ ...baseDemand, priority: "urgente" });

    expect(urgent).toBeGreaterThan(medium);
  });

  it("recalculates when effort changes", () => {
    const lowEffort = getPriorityScore({ ...baseDemand, effort_points: 1 });
    const highEffort = getPriorityScore({ ...baseDemand, effort_points: 21 });

    expect(highEffort).toBeGreaterThan(lowEffort);
  });

  it("recalculates when the deadline changes", () => {
    const shortDeadline = getPriorityScore(baseDemand);
    const longDeadline = getPriorityScore({
      ...baseDemand,
      due_date: "2026-09-09T00:00:00.000Z",
    });

    expect(shortDeadline).toBeGreaterThan(longDeadline);
  });

  it("keeps backlog demands without a deadline at the end of the score queue", () => {
    expect(getPriorityScore({ ...baseDemand, due_date: null })).toBe(0);
  });
});