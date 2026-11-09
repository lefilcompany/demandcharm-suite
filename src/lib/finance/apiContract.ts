// Contract v1 of the external finance API (Edge finance-api-v1). Used by the mock consumer and tests.
export const V1_NUMERIC_FIELDS = [
  "gross", "tax", "variable_costs", "direct_expenses", "alloc_fixed", "alloc_operational", "alloc_admin",
  "team_cost", "hours", "hours_without_cost", "tax_rate", "variable_rate", "margin_target",
] as const;

export interface V1Page { version: string; competence: string; items: Record<string, unknown>[]; next_cursor: string | null }

/** Returns the list of contract violations in one page (empty = valid). */
export function validateV1Page(p: any): string[] {
  const errs: string[] = [];
  if (!p || typeof p !== "object") return ["page is not an object"];
  if (p.version !== "v1") errs.push("version must be v1");
  if (!/^\d{4}-\d{2}-01$/.test(String(p.competence ?? ""))) errs.push("competence must be YYYY-MM-01");
  if (!Array.isArray(p.items)) return [...errs, "items must be an array"];
  if (p.next_cursor !== null && p.next_cursor !== undefined && typeof p.next_cursor !== "string") errs.push("next_cursor must be string or null");
  p.items.forEach((it: any, i: number) => {
    if (typeof it?.project_id !== "string") errs.push(`items[${i}].project_id missing`);
    if (!["open", "closed", "closed_adjusted"].includes(it?.period_status)) errs.push(`items[${i}].period_status invalid`);
    for (const f of V1_NUMERIC_FIELDS) if (typeof it?.[f] !== "number" || !Number.isFinite(it[f])) errs.push(`items[${i}].${f} must be a number`);
  });
  return errs;
}

/** Walks every page until next_cursor is null; refuses repeated cursors (infinite loop guard). */
export async function fetchAllV1(fetchPage: (cursor: string | null) => Promise<V1Page>, maxPages = 100) {
  const items: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPage(cursor);
    const errs = validateV1Page(page);
    if (errs.length) throw new Error(`CONTRACT: ${errs.join("; ")}`);
    items.push(...page.items);
    if (!page.next_cursor) return items;
    if (seen.has(page.next_cursor)) throw new Error("CURSOR_LOOP");
    seen.add(page.next_cursor);
    cursor = page.next_cursor;
  }
  throw new Error("TOO_MANY_PAGES");
}
