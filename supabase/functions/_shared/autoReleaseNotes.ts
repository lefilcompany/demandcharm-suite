/**
 * autoReleaseNotes (shared backend module)
 *
 * Patch notes gerados automaticamente pelo sistema.
 *
 * Entrada: a lista de mudanças (commits) embarcada no `build-info.json` da
 * build que está REALMENTE no ar. Saída: features de release no mesmo contrato
 * do `release-manifest.json`, prontas para o pipeline já existente
 * (ingest-release-event -> platform_events -> release_deliveries -> notificação
 * interna).
 *
 * Este arquivo é puro/dependency-free de propósito: a chamada à IA é injetada,
 * o que mantém a lógica testável sem rede.
 */

import type { ReleaseFeature, ReleasePriority } from "./releaseManifest.ts";

export interface BuildChange {
  sha: string;
  subject: string;
}

export type PatchNoteType = "feature" | "fix" | "improvement";

export interface GeneratedNote {
  type: PatchNoteType;
  title: string;
  summary: string;
}

/** Mensagens de commit sem valor de comunicação para o usuário final. */
const NOISE_PATTERNS: RegExp[] = [
  /^merge\b/i,
  /^revert\b/i,
  /^wip\b/i,
  /^chore\b/i,
  /^ci\b/i,
  /^build\b/i,
  /^bump\b/i,
  /^lint\b/i,
  /^format\b/i,
  /^(changes|update|updates|ajustes?|alteraç(ão|ões))\.?$/i,
];

export const MAX_CHANGES = 60;
export const MAX_NOTES = 6;

const TITLE_MAX = 120;
const SUMMARY_MAX = 300;

const TYPE_LABEL: Record<PatchNoteType, string> = {
  feature: "Novidade",
  fix: "Correção",
  improvement: "Melhoria",
};

/**
 * Mantém apenas os commits ainda não anunciados (mais recentes que
 * `lastAnnouncedSha`) e descarta ruído de manutenção.
 */
export function selectAnnounceableChanges(
  changes: BuildChange[],
  lastAnnouncedSha?: string | null,
): BuildChange[] {
  const list = Array.isArray(changes) ? changes : [];
  const cutIndex = lastAnnouncedSha
    ? list.findIndex((c) => c.sha && lastAnnouncedSha.startsWith(c.sha.slice(0, 7)))
    : -1;
  const fresh = cutIndex >= 0 ? list.slice(0, cutIndex) : list;

  const seen = new Set<string>();
  const result: BuildChange[] = [];
  for (const change of fresh) {
    const subject = (change?.subject ?? "").trim();
    if (!subject) continue;
    if (NOISE_PATTERNS.some((re) => re.test(subject))) continue;
    const key = subject.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ sha: change.sha ?? "", subject });
    if (result.length >= MAX_CHANGES) break;
  }
  return result;
}

export const PATCH_NOTES_SYSTEM_PROMPT = [
  "Você escreve as notas de atualização (patch notes) do SoMA, um sistema de gestão de demandas em português do Brasil.",
  "Receberá mensagens técnicas de commits de uma publicação e deve traduzi-las em avisos curtos para usuários não técnicos.",
  "Regras:",
  "- Agrupe mudanças relacionadas em um único item; no máximo " + MAX_NOTES + " itens.",
  "- Ignore mudanças internas sem efeito visível (refatorações, testes, dependências, configuração).",
  "- Se nada for relevante para o usuário, devolva uma lista vazia.",
  '- "type" deve ser "feature" (novidade), "fix" (correção) ou "improvement" (melhoria).',
  "- \"title\": no máximo 70 caracteres, sem ponto final, sem jargão técnico e sem nomes de arquivos.",
  "- \"summary\": 1 a 2 frases (máx. 260 caracteres) explicando o benefício prático.",
  'Responda SOMENTE com JSON no formato: {"notes":[{"type":"feature","title":"...","summary":"..."}]}',
].join("\n");

export function buildPatchNotesPrompt(changes: BuildChange[]): string {
  return [
    "Mudanças publicadas nesta versão:",
    ...changes.map((c) => `- ${c.subject}`),
    "",
    "Gere as notas de atualização em JSON.",
  ].join("\n");
}

function clamp(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Normaliza/valida a resposta do modelo. Entradas inválidas são descartadas. */
export function parseGeneratedNotes(raw: unknown): GeneratedNote[] {
  let payload: unknown = raw;
  if (typeof payload === "string") {
    const trimmed = payload.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
    try {
      payload = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  const container = payload as { notes?: unknown } | unknown[];
  const list = Array.isArray(container) ? container : (container?.notes as unknown);
  if (!Array.isArray(list)) return [];

  const notes: GeneratedNote[] = [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const summary = typeof row.summary === "string" ? row.summary.trim() : "";
    if (!title || !summary) continue;
    const type: PatchNoteType =
      row.type === "fix" || row.type === "improvement" || row.type === "feature"
        ? (row.type as PatchNoteType)
        : "improvement";
    notes.push({
      type,
      title: clamp(title, TITLE_MAX - 12),
      summary: clamp(summary, SUMMARY_MAX),
    });
    if (notes.length >= MAX_NOTES) break;
  }
  return notes;
}

/** Prioridade do anúncio: correções entram como `normal`, novidades `high`. */
function priorityFor(type: PatchNoteType): ReleasePriority {
  return type === "feature" ? "high" : "normal";
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Converte as notas geradas em features de release (canal interno apenas).
 * `releaseKey` garante `announcementKey` único por publicação.
 */
export function notesToReleaseFeatures(
  notes: GeneratedNote[],
  releaseKey: string,
): ReleaseFeature[] {
  const base = slug(releaseKey) || "release";
  return notes.map((note, index) => ({
    announcementKey: `auto-${base}-${index + 1}-${slug(note.title) || note.type}`.slice(0, 120),
    featureKey: `auto-${note.type}`,
    title: clamp(`${TYPE_LABEL[note.type]}: ${note.title}`, TITLE_MAX),
    summary: note.summary,
    ctaPath: undefined,
    ctaLabel: undefined,
    priority: priorityFor(note.type),
    audience: {
      scope: "global" as const,
      globalRoles: ["admin", "moderator", "user"] as ReleaseFeature["audience"]["globalRoles"],
      teamRoles: [],
      boardRoles: [],
      teamId: null,
      boardId: null,
    },
    channels: { email: false, inapp: true },
  }));
}
