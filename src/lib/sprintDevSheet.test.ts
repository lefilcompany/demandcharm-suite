import { describe, it, expect } from "vitest";
import { buildDiffEvents, buildDevSheetMetrics, deliveredOnTime, type DevSheetInput } from "./sprintDevSheet";

const base = (over: Partial<DevSheetInput> = {}): DevSheetInput => ({
  sprint: { start_date: "2026-10-01", end_date: "2026-10-14" },
  demands: [
    { id: "a", code: "#0001", title: "A", stage: "Entregue", isDelivered: true, deliveredAt: "2026-10-05T10:00:00Z", dueDate: "2026-10-04T00:00:00Z", statusChangedAt: "2026-10-05T10:00:00Z", effort: 5, responsible: "Ana" },
    { id: "b", code: "#0002", title: "B", stage: "Fazendo", isDelivered: false, deliveredAt: null, dueDate: "2026-10-02T00:00:00Z", statusChangedAt: "2026-09-20T00:00:00Z", effort: 3, responsible: "Ana" },
  ],
  addedAt: { a: "2026-10-01T09:00:00Z", b: "2026-10-01T09:00:00Z" },
  carriedIds: new Set(["b"]),
  dueChanges: [],
  secondsByDemand: { a: 7200 },
  ...over,
});

describe("sprint dev sheet", () => {
  it("entrega depois do prazo conta como atrasada", () => {
    expect(deliveredOnTime("2026-10-05T10:00:00Z", "2026-10-04T00:00:00Z")).toBe(false);
    expect(deliveredOnTime("2026-10-04T23:00:00Z", "2026-10-04T00:00:00Z")).toBe(true);
  });

  it("demanda carregada aparece como vinda da sprint anterior, não como entrada", () => {
    const ev = buildDiffEvents(base());
    expect(ev.filter((e) => e.code === "#0002").map((e) => e.kind)).toEqual(["carried"]);
  });

  it("mudança de etapa fora do período da sprint não vira diff", () => {
    const ev = buildDiffEvents(base());
    expect(ev.some((e) => e.kind === "stage")).toBe(false);
  });

  it("métricas: conclusão, esforço e horas", () => {
    const m = buildDevSheetMetrics(base(), "2026-10-10T00:00:00Z");
    expect(m.completionPct).toBe(50);
    expect(m.effortPlanned).toBe(8);
    expect(m.effortDelivered).toBe(5);
    expect(m.hours).toBe(2);
    expect(m.overdue).toBe(1);
    expect(m.deliveredLate).toBe(1);
  });
});
