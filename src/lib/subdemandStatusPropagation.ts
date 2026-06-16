import type { Subdemand } from "@/hooks/useSubdemands";

/**
 * Status names that count as "execução ativa" — quando subdemandas estão
 * nesses estados, vale a pena pedir confirmação antes de propagar status da pai,
 * pois cronômetros podem estar rodando.
 */
const ACTIVE_STATUS_NAMES = new Set(["Fazendo", "Em Ajuste"]);

/**
 * Adjustment types que indicam um status de finalização/revisão.
 * Esses status, junto com "Entregue", recebem propagação automática.
 */
const FINALIZATION_ADJUSTMENT_TYPES = new Set(["internal", "external"]);

interface BoardStatusLike {
  status_id: string;
  adjustment_type?: string | null;
  status?: { name?: string | null } | null;
}

/**
 * Determina se o status alvo é considerado "de finalização" e portanto
 * dispara a propagação para subdemandas.
 *
 * Critérios:
 * - É o status "Entregue" do sistema, OU
 * - Possui `adjustment_type` igual a 'internal' (Aprovação Interna) ou
 *   'external' (Aprovação do Cliente).
 */
export function isFinalizationStatus(
  boardStatus: BoardStatusLike | null | undefined,
  deliveredStatusId: string | null | undefined
): boolean {
  if (!boardStatus) return false;
  if (deliveredStatusId && boardStatus.status_id === deliveredStatusId) return true;
  if (boardStatus.adjustment_type && FINALIZATION_ADJUSTMENT_TYPES.has(boardStatus.adjustment_type)) {
    return true;
  }
  return false;
}

export interface SubdemandPropagationAnalysis {
  /** Subdemandas que vão ser efetivamente movidas (que ainda não estão no status alvo). */
  toMoveCount: number;
  /** Subdemandas em "Fazendo" ou "Em Ajuste" entre as que serão movidas. */
  activeCount: number;
  /** Subdemandas com cronômetro rodando (last_started_at != null) entre as que serão movidas. */
  runningTimerCount: number;
  /** Se devemos exibir confirmação antes de propagar. */
  needsConfirmation: boolean;
}

/**
 * Analisa as subdemandas e decide se a propagação precisa de confirmação do usuário.
 * Sempre exige confirmação quando há subdemandas a serem movidas — assim o usuário
 * tem visibilidade clara da ação e pode optar por mover apenas a principal.
 */
export function analyzeSubdemandsForPropagation(
  subdemands: Subdemand[] | null | undefined,
  targetStatusId: string
): SubdemandPropagationAnalysis {
  const list = (subdemands || []).filter((s) => s.status_id !== targetStatusId);

  let activeCount = 0;

  for (const sub of list) {
    const statusName = sub.demand_statuses?.name ?? "";
    if (ACTIVE_STATUS_NAMES.has(statusName)) activeCount += 1;
  }

  // Como proxy para "tem timer rodando", contamos quantas estão em status ativo.
  // O backend (RPC propagate_status_to_subdemands) encerra qualquer timer aberto
  // independentemente do status, via demand_time_entries.
  const runningTimerCount = activeCount;

  return {
    toMoveCount: list.length,
    activeCount,
    runningTimerCount,
    // Sempre confirmar quando houver subdemandas a mover — garante visibilidade
    // da operação e oferece ao usuário a opção "mover apenas a principal".
    needsConfirmation: list.length > 0,
  };
}
