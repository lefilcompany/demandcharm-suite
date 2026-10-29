import { describe, it, expect } from "vitest";
import { sliceEntries, personCost } from "./timeSlices";

const t = (iso: string) => new Date(iso).getTime();
const sum = (xs: { hours: number }[]) => xs.reduce((a, x) => a + x.hours, 0);

describe("sliceEntries", () => {
  it("timer de 31/out 23h a 01/nov 01h conta 1h em cada mês", () => {
    const e = [{ id: "a", userId: "u", start: t("2026-10-31T23:00:00-03:00"), end: t("2026-11-01T01:00:00-03:00") }];
    const oct = sliceEntries(e, "2026-10-01");
    const nov = sliceEntries(e, "2026-11-01");
    expect(oct[0].hours).toBeCloseTo(1);
    expect(nov[0].hours).toBeCloseTo(1);
    expect(oct[0].split).toBe(true);
  });

  it("timers paralelos da mesma pessoa contam o trecho comum uma vez só", () => {
    const e = [
      { id: "a", userId: "u", start: t("2026-11-05T10:00:00-03:00"), end: t("2026-11-05T12:00:00-03:00") },
      { id: "b", userId: "u", start: t("2026-11-05T11:00:00-03:00"), end: t("2026-11-05T13:00:00-03:00") },
    ];
    const s = sliceEntries(e, "2026-11-01");
    expect(sum(s)).toBeCloseTo(3);
    expect(s.find((x) => x.id === "a")!.hours).toBeCloseTo(1.5);
    expect(s.every((x) => x.overlapped)).toBe(true);
  });

  it("pessoas diferentes ao mesmo tempo não são deduplicadas", () => {
    const e = [
      { id: "a", userId: "u1", start: t("2026-11-05T10:00:00-03:00"), end: t("2026-11-05T12:00:00-03:00") },
      { id: "b", userId: "u2", start: t("2026-11-05T10:00:00-03:00"), end: t("2026-11-05T12:00:00-03:00") },
    ];
    expect(sum(sliceEntries(e, "2026-11-01"))).toBeCloseTo(4);
  });

  it("timer em andamento conta até agora e é sinalizado", () => {
    const now = t("2026-11-05T12:00:00-03:00");
    const s = sliceEntries([{ id: "a", userId: "u", start: t("2026-11-05T10:00:00-03:00"), end: null }], "2026-11-01", now);
    expect(s[0].hours).toBeCloseTo(2);
    expect(s[0].running).toBe(true);
  });
});

describe("personCost", () => {
  it("pessoa com horas e sem custo/hora fica faltante, não zero", () => {
    expect(personCost(4, null)).toBeNull();
  });
  it("calcula horas × custo/hora", () => {
    expect(personCost(2.5, 80)).toBe(200);
  });
});
