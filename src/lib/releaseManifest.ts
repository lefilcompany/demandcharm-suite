/**
 * Release Manifest contract (shared).
 *
 * Single source of truth for the shape, validation and parsing of
 * `release-manifest.json`. Dependency-free on purpose so the same file can be
 * reused by edge functions / scripts without bundling concerns.
 *
 * `announcementKey` identifies a UNIQUE announcement. A future major update of
 * the same feature must use a new key (e.g. `advanced-reports-v2`).
 */

export const RELEASE_PRIORITIES = ["critical", "high", "normal", "low"] as const;
export type ReleasePriority = (typeof RELEASE_PRIORITIES)[number];

export const RELEASE_AUDIENCE_SCOPES = ["global", "team", "board"] as const;
export type ReleaseAudienceScope = (typeof RELEASE_AUDIENCE_SCOPES)[number];

/** Global roles come from the existing `app_role` taxonomy (public.user_roles). */
export const GLOBAL_ROLES = ["admin", "moderator", "user"] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

/** Team/board roles reuse the current taxonomy. Do not invent new ones. */
export const MEMBER_ROLES = ["admin", "moderator", "executor", "requester"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export interface ReleaseAudience {
  scope: ReleaseAudienceScope;
  globalRoles: GlobalRole[];
  teamRoles: MemberRole[];
  boardRoles: MemberRole[];
  teamId: string | null;
  boardId: string | null;
}

export interface ReleaseChannels {
  email: boolean;
  inapp: boolean;
}

export interface ReleaseFeature {
  announcementKey: string;
  featureKey: string;
  title: string;
  summary: string;
  emailBody?: string;
  ctaPath?: string;
  ctaLabel?: string;
  priority: ReleasePriority;
  audience: ReleaseAudience;
  channels: ReleaseChannels;
}

export interface ReleaseManifest {
  version: number;
  features: ReleaseFeature[];
}

export const LIMITS = {
  announcementKey: 120,
  title: 120,
  summary: 300,
  emailBody: 5000,
  ctaLabel: 60,
} as const;

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ManifestParseResult =
  | { success: true; data: ReleaseManifest }
  | { success: false; issues: ValidationIssue[] };

const FORBIDDEN_CTA_PREFIXES = ["javascript:", "data:", "http://", "https://", "//"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Rejects anything that is not a purely internal route. */
export function isValidCtaPath(path: string): boolean {
  const value = path.trim();
  if (!value.startsWith("/")) return false;
  const lowered = value.toLowerCase();
  if (FORBIDDEN_CTA_PREFIXES.some((prefix) => lowered.startsWith(prefix))) return false;
  // Guard against escaped/backslash based protocol-relative tricks.
  if (lowered.startsWith("/\\") || lowered.includes("://")) return false;
  return true;
}

function requiredString(
  value: unknown,
  path: string,
  maxLength: number | null,
  issues: ValidationIssue[],
): string {
  if (typeof value !== "string" || value.trim() === "") {
    issues.push({ path, message: "obrigatório e deve ser um texto não vazio" });
    return "";
  }
  if (maxLength !== null && value.length > maxLength) {
    issues.push({ path, message: `deve ter no máximo ${maxLength} caracteres` });
  }
  return value;
}

function optionalString(
  value: unknown,
  path: string,
  maxLength: number,
  issues: ValidationIssue[],
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    issues.push({ path, message: "deve ser um texto" });
    return undefined;
  }
  if (value.length > maxLength) {
    issues.push({ path, message: `deve ter no máximo ${maxLength} caracteres` });
  }
  return value;
}

function roleArray<T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
  issues: ValidationIssue[],
): T[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    issues.push({ path, message: "deve ser uma lista" });
    return [];
  }
  const result: T[] = [];
  value.forEach((role, index) => {
    if (typeof role !== "string" || !allowed.includes(role as T)) {
      issues.push({
        path: `${path}[${index}]`,
        message: `valor inválido. Use: ${allowed.join(", ")}`,
      });
      return;
    }
    result.push(role as T);
  });
  return result;
}

function nullableId(value: unknown, path: string, issues: ValidationIssue[]): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    issues.push({ path, message: "deve ser um identificador em texto ou null" });
    return null;
  }
  return value;
}

function booleanFlag(
  value: unknown,
  path: string,
  fallback: boolean,
  issues: ValidationIssue[],
): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") {
    issues.push({ path, message: "deve ser true ou false" });
    return fallback;
  }
  return value;
}

function validateAudience(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): ReleaseAudience {
  const fallback: ReleaseAudience = {
    scope: "global",
    globalRoles: [],
    teamRoles: [],
    boardRoles: [],
    teamId: null,
    boardId: null,
  };

  if (!isRecord(value)) {
    issues.push({ path, message: "obrigatório e deve ser um objeto" });
    return fallback;
  }

  const scopeRaw = value.scope;
  let scope: ReleaseAudienceScope = "global";
  if (typeof scopeRaw !== "string" || !RELEASE_AUDIENCE_SCOPES.includes(scopeRaw as ReleaseAudienceScope)) {
    issues.push({
      path: `${path}.scope`,
      message: `valor inválido. Use: ${RELEASE_AUDIENCE_SCOPES.join(", ")}`,
    });
  } else {
    scope = scopeRaw as ReleaseAudienceScope;
  }

  const teamId = nullableId(value.teamId, `${path}.teamId`, issues);
  const boardId = nullableId(value.boardId, `${path}.boardId`, issues);

  if (scope === "team" && !teamId) {
    issues.push({ path: `${path}.teamId`, message: "obrigatório quando scope = team" });
  }
  if (scope === "board" && !boardId) {
    issues.push({ path: `${path}.boardId`, message: "obrigatório quando scope = board" });
  }

  return {
    scope,
    globalRoles: roleArray(value.globalRoles, `${path}.globalRoles`, GLOBAL_ROLES, issues),
    teamRoles: roleArray(value.teamRoles, `${path}.teamRoles`, MEMBER_ROLES, issues),
    boardRoles: roleArray(value.boardRoles, `${path}.boardRoles`, MEMBER_ROLES, issues),
    teamId,
    boardId,
  };
}

function validateFeature(value: unknown, path: string, issues: ValidationIssue[]): ReleaseFeature {
  if (!isRecord(value)) {
    issues.push({ path, message: "deve ser um objeto" });
    value = {};
  }
  const raw = value as Record<string, unknown>;

  const announcementKey = requiredString(
    raw.announcementKey,
    `${path}.announcementKey`,
    LIMITS.announcementKey,
    issues,
  );
  const featureKey = requiredString(raw.featureKey, `${path}.featureKey`, null, issues);
  const title = requiredString(raw.title, `${path}.title`, LIMITS.title, issues);
  const summary = requiredString(raw.summary, `${path}.summary`, LIMITS.summary, issues);
  const emailBody = optionalString(raw.emailBody, `${path}.emailBody`, LIMITS.emailBody, issues);
  const ctaLabel = optionalString(raw.ctaLabel, `${path}.ctaLabel`, LIMITS.ctaLabel, issues);

  let ctaPath: string | undefined;
  if (raw.ctaPath !== undefined && raw.ctaPath !== null && raw.ctaPath !== "") {
    if (typeof raw.ctaPath !== "string" || !isValidCtaPath(raw.ctaPath)) {
      issues.push({
        path: `${path}.ctaPath`,
        message: "deve ser uma rota interna iniciando com / (URLs externas não são permitidas)",
      });
    } else {
      ctaPath = raw.ctaPath.trim();
    }
  }

  let priority: ReleasePriority = "normal";
  if (typeof raw.priority !== "string" || !RELEASE_PRIORITIES.includes(raw.priority as ReleasePriority)) {
    issues.push({
      path: `${path}.priority`,
      message: `valor inválido. Use: ${RELEASE_PRIORITIES.join(", ")}`,
    });
  } else {
    priority = raw.priority as ReleasePriority;
  }

  const audience = validateAudience(raw.audience, `${path}.audience`, issues);

  const channelsRaw = raw.channels;
  if (channelsRaw !== undefined && channelsRaw !== null && !isRecord(channelsRaw)) {
    issues.push({ path: `${path}.channels`, message: "deve ser um objeto" });
  }
  const channelsRecord = isRecord(channelsRaw) ? channelsRaw : {};
  const channels: ReleaseChannels = {
    email: booleanFlag(channelsRecord.email, `${path}.channels.email`, true, issues),
    inapp: booleanFlag(channelsRecord.inapp, `${path}.channels.inapp`, true, issues),
  };

  return {
    announcementKey,
    featureKey,
    title,
    summary,
    ...(emailBody !== undefined ? { emailBody } : {}),
    ...(ctaPath !== undefined ? { ctaPath } : {}),
    ...(ctaLabel !== undefined ? { ctaLabel } : {}),
    priority,
    audience,
    channels,
  };
}

/** Validates an already-parsed manifest object. Never throws. */
export function validateReleaseManifest(input: unknown): ManifestParseResult {
  const issues: ValidationIssue[] = [];

  if (!isRecord(input)) {
    return { success: false, issues: [{ path: "$", message: "manifest deve ser um objeto JSON" }] };
  }

  const version = typeof input.version === "number" ? input.version : NaN;
  if (!Number.isInteger(version) || version < 1) {
    issues.push({ path: "version", message: "deve ser um inteiro >= 1" });
  }

  const featuresRaw = input.features;
  const features: ReleaseFeature[] = [];
  if (!Array.isArray(featuresRaw)) {
    issues.push({ path: "features", message: "deve ser uma lista" });
  } else {
    const seen = new Set<string>();
    featuresRaw.forEach((item, index) => {
      const feature = validateFeature(item, `features[${index}]`, issues);
      if (feature.announcementKey) {
        if (seen.has(feature.announcementKey)) {
          issues.push({
            path: `features[${index}].announcementKey`,
            message: `announcementKey duplicado: "${feature.announcementKey}"`,
          });
        }
        seen.add(feature.announcementKey);
      }
      features.push(feature);
    });
  }

  if (issues.length > 0) return { success: false, issues };
  return { success: true, data: { version, features } };
}

/** Parses a raw JSON string into a validated manifest. Never throws. */
export function parseReleaseManifest(raw: string): ManifestParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      success: false,
      issues: [{ path: "$", message: `JSON inválido: ${(error as Error).message}` }],
    };
  }
  return validateReleaseManifest(parsed);
}

/** Convenience wrapper for scripts/edge functions that prefer exceptions. */
export function assertReleaseManifest(input: unknown): ReleaseManifest {
  const result = validateReleaseManifest(input);
  if (!result.success) {
    throw new Error(
      `Release manifest inválido:\n${result.issues.map((i) => `- ${i.path}: ${i.message}`).join("\n")}`,
    );
  }
  return result.data;
}

export function formatManifestIssues(issues: ValidationIssue[]): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
}
