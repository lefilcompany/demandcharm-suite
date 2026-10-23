import { describe, it, expect } from "vitest";
import { computeBoardPulse } from "./boardPulse";

const today = "2026-10-23";

describe("computeBoardPulse", () => {
  it("counts open demands past due date as overdue, ignoring delivered ones", () => {
    const r = computeBoardPulse(
      [
        { due_date: "2026-10-22T23:00:00Z", demand_statuses: { name: "Fazendo" } },
        { due_date: "2026-10-23", demand_statuses: { name: "Fazendo" } },
        { due_date: "2026-10-01", delivered_at: "2026-10-02", demand_statuses: { name: "Entregue" } },
      ],
      today,
    );
    expect(r.overdue).toBe(1);
  });

  it("counts only demands delivered in the current month", () => {
    const r = computeBoardPulse(
      [
        { delivered_at: "2026-10-01T10:00:00Z" },
        { delivered_at: "2026-09-30T10:00:00Z" },
      ],
      today,
    );
    expect(r.deliveredMonth).toBe(1);
  });
});
