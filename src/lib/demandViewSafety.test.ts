import { describe, expect, it } from "vitest";

import { safeDateTimestamp, safeIncludesText, safeLowerText } from "./demandViewSafety";

describe("demand view safety helpers", () => {
  it("returns empty lowercase text for nullish or non-string values", () => {
    expect(safeLowerText(undefined)).toBe("");
    expect(safeLowerText(null)).toBe("");
    expect(safeLowerText(10)).toBe("");
  });

  it("matches text safely without throwing on missing fields", () => {
    expect(safeIncludesText("Categoria Oculta", "categoria")).toBe(true);
    expect(safeIncludesText(undefined, "categoria")).toBe(false);
    expect(safeIncludesText(null, "categoria")).toBe(false);
  });

  it("returns null for invalid dates so demand sorting does not crash", () => {
    expect(safeDateTimestamp(undefined)).toBeNull();
    expect(safeDateTimestamp("")).toBeNull();
    expect(safeDateTimestamp("not-a-date")).toBeNull();
    expect(typeof safeDateTimestamp("2026-06-09T12:00:00.000Z")).toBe("number");
  });
});