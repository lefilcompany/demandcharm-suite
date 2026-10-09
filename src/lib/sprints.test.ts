import { describe, it, expect } from "vitest";
import { sprintDaysRemaining, formatDaysRemaining, sprintProgress, canAddDemandToSprint, nextStageAfter } from "./sprints";

describe("sprints", () => {
  it("conta dias restantes e encerradas", () => {
    expect(sprintDaysRemaining("2026-10-20", "2026-10-09")).toBe(11);
    expect(formatDaysRemaining("2026-10-09", "2026-10-09")).toBe("Termina hoje");
    expect(formatDaysRemaining("2026-10-06", "2026-10-09")).toBe("Encerrada há 3 dias");
  });

  it("calcula progresso e atrasadas", () => {
    const p = sprintProgress(
      [
        { delivered_at: "2026-10-01T10:00:00Z", due_date: "2026-09-01" },
        { delivered_at: null, due_date: "2026-10-08" },
        { delivered_at: null, due_date: "2026-10-09" },
        { delivered_at: null, due_date: null },
      ],
      "2026-10-09"
    );
    expect(p).toEqual({ total: 4, delivered: 1, overdue: 1, percent: 25 });
  });

  it("bloqueia demanda que já está em outra sprint aberta", () => {
    const m = [{ demand_id: "d1", sprint_id: "s1", sprint_status: "active" as const }];
    expect(canAddDemandToSprint("d1", "s2", m)).toBe(false);
    expect(canAddDemandToSprint("d1", "s2", [{ ...m[0], sprint_status: "completed" }])).toBe(true);
  });

  it("move para a próxima etapa visível e bloqueia a última", () => {
    const cols = [{ statusId: "a" }, { statusId: "b" }, { statusId: "c" }];
    expect(nextStageAfter(cols, "a")?.statusId).toBe("b");
    expect(nextStageAfter(cols, "c")).toBeNull();
  });
});
