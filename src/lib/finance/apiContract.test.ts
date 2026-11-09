import { describe, expect, it } from "vitest";
import { fetchAllV1, validateV1Page, V1_NUMERIC_FIELDS } from "./apiContract";

const item = (id: string) => ({ project_id: id, period_status: "open", ...Object.fromEntries(V1_NUMERIC_FIELDS.map((f) => [f, 1])) });
const page = (ids: string[], next: string | null) => ({ version: "v1", competence: "2026-10-01", items: ids.map(item), next_cursor: next });

describe("finance API v1 contract", () => {
  it("accepts a valid page", () => expect(validateV1Page(page(["a"], null))).toEqual([]));
  it("rejects text where a number is required", () => {
    const p = page(["a"], null); (p.items[0] as any).gross = "10";
    expect(validateV1Page(p)).toContain("items[0].gross must be a number");
  });
  it("walks all pages in order", async () => {
    const pages: Record<string, any> = { start: page(["a", "b"], "b"), b: page(["c"], null) };
    const all = await fetchAllV1(async (c) => pages[c ?? "start"]);
    expect(all.map((i) => i.project_id)).toEqual(["a", "b", "c"]);
  });
  it("stops on a repeated cursor", async () => {
    await expect(fetchAllV1(async () => page(["a"], "x"))).rejects.toThrow("CURSOR_LOOP");
  });
});
