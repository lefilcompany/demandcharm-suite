import { describe, expect, it } from "vitest";
import { canEditArtifactContent, canManageArtifacts, formatAdrNumber, nextAdrNumber } from "./artifacts";

describe("artefatos da sprint", () => {
  it("numera ADRs em sequência por quadro", () => {
    expect(nextAdrNumber([])).toBe(1);
    expect(nextAdrNumber([1, 3, null])).toBe(4);
    expect(formatAdrNumber(7)).toBe("ADR-007");
  });

  it("ADR aceita não pode ser editada", () => {
    expect(canEditArtifactContent({ kind: "adr", adr_status: "accepted" })).toBe(false);
    expect(canEditArtifactContent({ kind: "adr", adr_status: "proposed" })).toBe(true);
    expect(canEditArtifactContent({ kind: "doc", adr_status: null })).toBe(true);
  });

  it("solicitante só visualiza", () => {
    expect(canManageArtifacts("requester")).toBe(false);
    expect(canManageArtifacts("executor")).toBe(true);
    expect(canManageArtifacts("moderator")).toBe(true);
    expect(canManageArtifacts(null)).toBe(false);
  });
});
