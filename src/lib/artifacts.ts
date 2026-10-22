export type ArtifactKind = "adr" | "demand_list" | "template" | "report" | "doc" | "other";
export type AdrStatus = "proposed" | "accepted" | "superseded" | "rejected";

export const ARTIFACT_KIND_LABEL: Record<ArtifactKind, string> = {
  adr: "ADR",
  demand_list: "Lista de demandas",
  template: "Modelo",
  report: "Relatório",
  doc: "Documentação",
  other: "Outro",
};

export const ADR_STATUS_LABEL: Record<AdrStatus, string> = {
  proposed: "Proposta",
  accepted: "Aceita",
  superseded: "Substituída",
  rejected: "Descartada",
};

export const ARTIFACT_MAX_BYTES = 20 * 1024 * 1024;

export const ADR_TEMPLATE_HTML = [
  "<h2>Contexto</h2><p>Qual problema ou situação motivou esta decisão?</p>",
  "<h2>Decisão</h2><p>O que foi decidido, de forma direta.</p>",
  "<h2>Alternativas consideradas</h2><ul><li>Opção A — prós e contras</li><li>Opção B — prós e contras</li></ul>",
  "<h2>Consequências</h2><p>O que muda, riscos e o que fica mais fácil ou mais difícil.</p>",
].join("");

export const formatAdrNumber = (n: number | null | undefined) =>
  n ? `ADR-${String(n).padStart(3, "0")}` : "ADR";

/** Próximo número de ADR do quadro (espelha a regra do banco). */
export const nextAdrNumber = (existing: (number | null | undefined)[]) =>
  existing.reduce<number>((m, n) => Math.max(m, n ?? 0), 0) + 1;

/** Quem pode criar/editar/excluir artefatos: todos os papéis do quadro menos solicitante. */
export const canManageArtifacts = (role: string | null | undefined) => !!role && role !== "requester";

/** ADR aceita é imutável: para mudar, cria-se outra que a substitui. */
export const canEditArtifactContent = (a: { kind: string; adr_status?: string | null }) =>
  !(a.kind === "adr" && a.adr_status === "accepted");

export const safeFileName = (name: string) =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120) || "arquivo";
