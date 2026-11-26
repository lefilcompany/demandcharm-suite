import { describe, expect, it } from "vitest";
import { inForceRow } from "./TeamDefaultsPanel";

const row = (valid_from: string, tax_rate: number) => ({ valid_from, tax_rate });
const ROWS = [row("2026-11-01", 0.12), row("2026-08-01", 0.09), row("2027-01-01", 0.18)];

describe("inForceRow", () => {
  it("usa a linha do próprio mês quando ela existe", () => {
    expect(inForceRow(ROWS, "2026-11")?.tax_rate).toBe(0.12);
  });

  it("retrocede para a linha mais recente anterior quando o mês não tem lançamento", () => {
    expect(inForceRow(ROWS, "2026-10")?.valid_from).toBe("2026-08-01");
    expect(inForceRow(ROWS, "2026-10")?.tax_rate).toBe(0.09);
  });

  it("não usa linha futura como valor em vigor", () => {
    expect(inForceRow([row("2027-01-01", 0.18)], "2026-11")).toBeUndefined();
  });

  it("não depende da ordem em que as linhas chegam", () => {
    expect(inForceRow([...ROWS].reverse(), "2026-11")?.tax_rate).toBe(0.12);
  });
});
