import { describe, it, expect } from "vitest";
import { priorityFromCode, snapEffort } from "./importMapping";

describe("importação de demandas", () => {
  it("mapeia P0/P1/P2 para prioridade", () => {
    expect(priorityFromCode("P0")).toBe("alta");
    expect(priorityFromCode("p1")).toBe("média");
    expect(priorityFromCode("P2")).toBe("baixa");
    expect(priorityFromCode(null)).toBe("média");
  });

  it("arredonda esforço para a escala", () => {
    expect(snapEffort(4)).toBe(3);
    expect(snapEffort(10)).toBe(8);
    expect(snapEffort(40)).toBe(21);
    expect(snapEffort("x")).toBe(3);
  });
});
