export interface PerformanceLink { performance_id: string; user_id: string | null | undefined }

/** Usuários que estão em pelo menos uma das performances escolhidas (sem repetição). */
export function userIdsInPerformances(links: PerformanceLink[], selected: string[]): string[] {
  const sel = new Set(selected);
  const out = new Set<string>();
  for (const l of links) if (l.user_id && sel.has(l.performance_id)) out.add(l.user_id);
  return [...out];
}

/** Só membros internos (não o dono da equipe) podem entrar numa performance. */
export function canJoinPerformance(memberKind: string | null | undefined, role?: string | null): boolean {
  return (memberKind ?? "internal") === "internal" && role !== "owner" && role !== "admin";
}
