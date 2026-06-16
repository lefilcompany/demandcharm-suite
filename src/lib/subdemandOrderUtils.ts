import type { DependencyInfo } from "@/hooks/useDependencyCheck";

/**
 * Validates a proposed subdemand ordering against dependency constraints.
 * A subdemand that depends on another (within the same parent group) MUST
 * appear AFTER its dependency in the ordered list.
 *
 * Subdemands without dependencies can be placed anywhere.
 *
 * @param orderedIds The proposed new order of subdemand IDs.
 * @param depsMap A map of subdemandId -> list of dependencies (from useBatchDependencyInfo).
 * @returns null if valid, or a human-readable error message if invalid.
 */
export function validateSubdemandOrder(
  orderedIds: string[],
  depsMap: Record<string, DependencyInfo[]> | undefined,
): string | null {
  if (!depsMap) return null;
  const positionById = new Map<string, number>();
  orderedIds.forEach((id, idx) => positionById.set(id, idx));

  for (const id of orderedIds) {
    const deps = depsMap[id] || [];
    const myPos = positionById.get(id)!;
    for (const dep of deps) {
      const depPos = positionById.get(dep.dependsOnDemandId);
      // Only enforce when the dependency is also a sibling in this list
      if (depPos === undefined) continue;
      if (depPos > myPos) {
        return `Não é possível mover: esta subdemanda depende de "${dep.dependsOnTitle}" e precisa vir depois dela.`;
      }
    }
  }
  return null;
}
