// Pure mirror of public.finance_auto_attribute_demand, for display and tests.
export type BoardLink = { projectId: string; boardId: string; validFrom: string; validTo: string | null; financeEnabled: boolean };
export type AttributionResult = { status: "auto" | "pending"; projectId: string | null; reason: "NO_PROJECT" | "MULTIPLE_PROJECTS" | null };

export function monthStart(date: string): string {
  return `${date.substring(0, 7)}-01`;
}

function monthEnd(start: string): string {
  const [y, m] = start.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${start.substring(0, 7)}-${String(last).padStart(2, "0")}`;
}

export function activeProjectsForBoard(links: BoardLink[], boardId: string, competence: string): string[] {
  const start = monthStart(competence);
  const end = monthEnd(start);
  const ids = links
    .filter((l) => l.financeEnabled && l.boardId === boardId && l.validFrom.substring(0, 10) <= end && (!l.validTo || l.validTo.substring(0, 10) >= start))
    .map((l) => l.projectId);
  return [...new Set(ids)];
}

export function resolveAttribution(links: BoardLink[], boardId: string, competence: string): AttributionResult {
  const ids = activeProjectsForBoard(links, boardId, competence);
  if (ids.length === 1) return { status: "auto", projectId: ids[0], reason: null };
  return { status: "pending", projectId: null, reason: ids.length === 0 ? "NO_PROJECT" : "MULTIPLE_PROJECTS" };
}

export const MEMBER_KIND_LABEL = { internal: "Interno", client_external: "Externo do cliente", contractor: "Prestador" } as const;
export type MemberKind = keyof typeof MEMBER_KIND_LABEL;
export const PENDING_REASON_LABEL: Record<string, string> = {
  NO_PROJECT: "Quadro sem projeto financeiro",
  MULTIPLE_PROJECTS: "Quadro em mais de um projeto",
};
