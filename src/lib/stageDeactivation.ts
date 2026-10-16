/**
 * Desativar uma etapa do quadro sem que nenhuma demanda suma do Kanban.
 *
 * O banco recusa desativar uma etapa que ainda tem demandas (erro
 * `STAGE_HAS_DEMANDS`, com a quantidade em `details`). A interface então pede
 * um destino e chama a RPC `deactivate_board_stage`, que move as demandas e
 * desativa a etapa numa única operação.
 */

export interface DeactivationStage {
  id: string;
  status_id: string;
  is_active: boolean;
  status: { name: string };
}

const normalize = (name: string | null | undefined) => (name ?? "").trim().toLowerCase();

/** Etapas com cronômetro: mover várias demandas para elas iniciaria o tempo de todas. */
export function isTimerStageName(name: string | null | undefined): boolean {
  const n = normalize(name);
  return n === "fazendo" || n === "em ajuste" || n === "ajuste";
}

const isDelivery = (name: string | null | undefined) => normalize(name) === "entregue";

/**
 * Etapas que podem receber as demandas da etapa desativada, na ordem exibida
 * no Kanban: ativas, diferentes da própria etapa e sem cronômetro.
 */
export function deactivationTargets<T extends DeactivationStage>(stages: T[], stageId: string): T[] {
  return stages.filter((s) => s.id !== stageId && s.is_active && !isTimerStageName(s.status.name));
}

/**
 * Destino sugerido: a próxima etapa do fluxo (sem contar "Entregue"); se não
 * houver, a anterior mais próxima; por último, "Entregue".
 */
export function defaultDeactivationTarget<T extends DeactivationStage>(stages: T[], stageId: string): T | null {
  const index = stages.findIndex((s) => s.id === stageId);
  const allowed = new Set(deactivationTargets(stages, stageId).map((s) => s.id));
  if (allowed.size === 0) return null;

  const pick = (candidates: T[]) => candidates.find((s) => allowed.has(s.id) && !isDelivery(s.status.name)) ?? null;

  if (index >= 0) {
    const next = pick(stages.slice(index + 1));
    if (next) return next;
    const previous = pick(stages.slice(0, index).reverse());
    if (previous) return previous;
  } else {
    const any = pick(stages);
    if (any) return any;
  }

  return stages.find((s) => allowed.has(s.id)) ?? null;
}

/** Quantidade de demandas quando o banco recusou a desativação; `null` para outros erros. */
export function stageHasDemandsCount(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const { message, details } = error as { message?: unknown; details?: unknown };
  if (message !== "STAGE_HAS_DEMANDS") return null;
  const count = Number(details);
  return Number.isFinite(count) && count > 0 ? count : 1;
}
