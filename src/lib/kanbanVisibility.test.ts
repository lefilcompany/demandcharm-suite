import { describe, it, expect } from "vitest";
import { isHiddenFromKanban } from "./kanbanVisibility";

const delivered = (at: string) => ({ delivered_at: at, demand_statuses: { name: "Entregue" } });

describe("isHiddenFromKanban", () => {
  it("mantém entregue há 31 dias e oculta há 32", () => {
    expect(isHiddenFromKanban(delivered("2026-09-08T12:00:00Z"), null, "2026-10-09")).toBe(false);
    expect(isHiddenFromKanban(delivered("2026-09-07T12:00:00Z"), null, "2026-10-09")).toBe(true);
  });

  it("oculta entregue antes da limpeza e mostra entregue depois", () => {
    const cleared = "2026-10-05T10:00:00Z";
    expect(isHiddenFromKanban(delivered("2026-10-04T10:00:00Z"), cleared, "2026-10-09")).toBe(true);
    expect(isHiddenFromKanban(delivered("2026-10-06T10:00:00Z"), cleared, "2026-10-09")).toBe(false);
  });

  it("nunca oculta demanda aberta", () => {
    expect(isHiddenFromKanban({ delivered_at: null, demand_statuses: { name: "Fazendo" } }, "2026-10-09T00:00:00Z", "2026-12-01")).toBe(false);
    expect(isHiddenFromKanban({ delivered_at: "2026-01-01T00:00:00Z", demand_statuses: { name: "Fazendo" } }, null, "2026-12-01")).toBe(false);
  });
});
