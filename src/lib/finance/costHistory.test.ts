import { describe, it, expect } from "vitest";
import { buildCostHistory } from "./costHistory";
const rows = [
  { cost_type: "fixa" as const, monthly_amount: 12000, valid_from: "2026-01-01", updated_at: "2026-01-02" },
  { cost_type: "fixa" as const, monthly_amount: 15000, valid_from: "2026-04-01", updated_at: "2026-04-01" },
];
describe("buildCostHistory", () => {
  it("uses the value in force each month", () => {
    const h = buildCostHistory(rows, 2026);
    expect(h.months[2].values.fixa).toBe(12000);
    expect(h.months[3].values.fixa).toBe(15000);
    expect(h.yearTotal).toBe(12000 * 3 + 15000 * 9);
  });
  it("records previous value on each change", () => {
    expect(buildCostHistory(rows, 2026).changes[1].previous).toBe(12000);
  });
});
