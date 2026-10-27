import { describe, expect, it } from "vitest";
import { allocate } from "./allocation";

const bases = [
  { boardId: "a", hours: 30, gross: 1000 },
  { boardId: "b", hours: 10, gross: 3000 },
  { boardId: "c", hours: 0, gross: 0 },
];
const sum = (o: ReturnType<typeof allocate>) => Math.round(o.parts.reduce((s, p) => s + p.amount, 0) * 100) / 100;

describe("allocate", () => {
  it("splits by hours", () => {
    const o = allocate({ amount: 1000, method: "hours" }, bases);
    expect(o.parts.find((p) => p.boardId === "a")!.amount).toBe(750);
    expect(o.parts.find((p) => p.boardId === "b")!.amount).toBe(250);
    expect(o.unallocated).toBe(0);
  });
  it("splits by revenue", () => {
    const o = allocate({ amount: 1000, method: "revenue" }, bases);
    expect(o.parts.find((p) => p.boardId === "b")!.amount).toBe(750);
  });
  it("mixed 50/50", () => {
    const o = allocate({ amount: 1000, method: "mixed", hoursWeight: 0.5 }, bases);
    expect(o.parts.find((p) => p.boardId === "a")!.amount).toBe(500); // 375 + 125
    expect(o.parts.find((p) => p.boardId === "b")!.amount).toBe(500);
  });
  it("cents always add up to the amount", () => {
    const o = allocate({ amount: 100, method: "hours" }, [
      { boardId: "x", hours: 1, gross: 0 }, { boardId: "y", hours: 1, gross: 0 }, { boardId: "z", hours: 1, gross: 0 },
    ]);
    expect(sum(o)).toBe(100);
    expect(o.unallocated).toBe(0);
  });
  it("zero base stays unallocated", () => {
    const o = allocate({ amount: 500, method: "revenue" }, [{ boardId: "c", hours: 5, gross: 0 }]);
    expect(o.parts).toHaveLength(0);
    expect(o.unallocated).toBe(500);
  });
  it("mixed with no revenue leaves the revenue part unallocated", () => {
    const o = allocate({ amount: 1000, method: "mixed", hoursWeight: 0.6 }, [{ boardId: "a", hours: 10, gross: 0 }]);
    expect(o.parts[0].amount).toBe(600);
    expect(o.unallocated).toBe(400);
  });
  it("respects the board filter", () => {
    const o = allocate({ amount: 1000, method: "hours", boardIds: ["b"] }, bases);
    expect(o.parts).toEqual([{ boardId: "b", share: 1, amount: 1000 }]);
  });
});
