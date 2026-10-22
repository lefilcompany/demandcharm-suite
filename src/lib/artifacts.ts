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
  "<p><strong>Data:</strong> dd/mm/aaaa · <strong>Responsáveis pela decisão:</strong> nomes · <strong>Consultados:</strong> nomes</p>",
  "<h2>1. Contexto e problema</h2>",
  "<p>Descreva a situação atual e o problema em 2 a 4 frases. O que acontece hoje? Por que precisamos decidir agora?</p>",
  "<h2>2. Critérios da decisão</h2>",
  "<ul><li>Ex.: custo mensal</li><li>Ex.: prazo de entrega</li><li>Ex.: facilidade de manutenção pelo time</li></ul>",
  "<h2>3. Opções consideradas</h2>",
  "<h3>Opção A — nome</h3><ul><li><strong>A favor:</strong> …</li><li><strong>Contra:</strong> …</li><li><strong>Esforço estimado:</strong> …</li></ul>",
  "<h3>Opção B — nome</h3><ul><li><strong>A favor:</strong> …</li><li><strong>Contra:</strong> …</li><li><strong>Esforço estimado:</strong> …</li></ul>",
  "<h3>Opção C — não fazer nada</h3><ul><li><strong>O que acontece se mantivermos como está:</strong> …</li></ul>",
  "<h2>4. Decisão</h2>",
  "<p><strong>Escolhemos a Opção …</strong> porque … (ligue a justificativa aos critérios do item 2).</p>",
  "<h2>5. Consequências</h2>",
  "<ul><li><strong>Positivas:</strong> o que fica mais fácil ou melhor.</li><li><strong>Negativas:</strong> o que aceitamos perder ou piorar.</li><li><strong>Impacto em outras áreas ou times:</strong> …</li></ul>",
  "<h2>6. Riscos e como reduzir</h2>",
  "<ul><li><strong>Risco:</strong> … → <strong>Como reduzir:</strong> …</li></ul>",
  "<h2>7. Próximos passos</h2>",
  "<ul><li>Ação — responsável — prazo (crie as demandas e cite-as em \"Demandas relacionadas\")</li></ul>",
  "<h2>8. Como saber se deu certo</h2>",
  "<p>Indicador ou sinal que mostra que a decisão funcionou, e quando vamos revisá-la.</p>",
  "<h2>9. Referências</h2>",
  "<ul><li>Links, documentos, conversas ou ADRs anteriores.</li></ul>",
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
