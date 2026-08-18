/**
 * resolveFeatureAudience (shared backend module)
 *
 * Single source of truth to answer: "who is allowed to receive this release
 * feature announcement?".
 *
 * Rules:
 *  - Access defines WHO receives. `priority` NEVER influences the audience.
 *  - Reuses the existing tables/roles of the project:
 *      global -> public.user_roles (same source as `has_role`)
 *      team   -> public.team_members (team_id + role)
 *      board  -> public.board_members (board_id + role) — exactly the source
 *                used today by useBoardRole/useBoardMembers on the frontend.
 *  - No parallel tables, no Auth Admin per-user calls, no N+1: every scope is
 *    resolved with a single batched query, plus one batched profiles query to
 *    drop non-existent users.
 *
 * The resolution logic is pure and testable through the `AudienceDataSource`
 * interface; `createSupabaseAudienceSource` is the production implementation.
 */

export type AudienceScope = "global" | "team" | "board";

/** Minimal shape needed from a `release_features` row. */
export interface FeatureAudienceInput {
  audience_scope: string | null;
  global_roles?: string[] | null;
  team_roles?: string[] | null;
  board_roles?: string[] | null;
  team_id?: string | null;
  board_id?: string | null;
}

export interface AudienceResolution {
  userIds: string[];
  totalResolved: number;
  scope: string;
}

export interface AudienceDataSource {
  /** public.user_roles filtered by role. */
  listGlobalRoleUserIds(roles: string[]): Promise<string[]>;
  /** public.team_members filtered by team + role. */
  listTeamMemberUserIds(teamId: string, roles: string[]): Promise<string[]>;
  /** public.board_members filtered by board + role. */
  listBoardMemberUserIds(boardId: string, roles: string[]): Promise<string[]>;
  /** Batched existence check against public.profiles. */
  filterExistingUserIds(userIds: string[]): Promise<string[]>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUserId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

/** Drops invalid memberships and duplicates, preserving first-seen order. */
export function normalizeUserIds(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    if (!isValidUserId(raw)) continue;
    const id = raw.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function cleanRoles(roles: string[] | null | undefined): string[] {
  if (!Array.isArray(roles)) return [];
  return Array.from(
    new Set(roles.filter((r): r is string => typeof r === "string" && r.trim() !== "").map((r) => r.trim())),
  );
}

function empty(scope: string): AudienceResolution {
  return { userIds: [], totalResolved: 0, scope };
}

/**
 * Resolves the user ids that really have access to a feature.
 * Never throws for invalid configuration — returns an empty audience instead.
 */
export async function resolveFeatureAudience(
  feature: FeatureAudienceInput,
  source: AudienceDataSource,
): Promise<AudienceResolution> {
  const scope = (feature.audience_scope ?? "").trim() as AudienceScope;

  let candidates: string[] = [];

  if (scope === "global") {
    const roles = cleanRoles(feature.global_roles);
    if (roles.length === 0) return empty(scope);
    candidates = await source.listGlobalRoleUserIds(roles);
  } else if (scope === "team") {
    const roles = cleanRoles(feature.team_roles);
    const teamId = feature.team_id ?? "";
    if (roles.length === 0 || !isValidUserId(teamId)) return empty(scope);
    candidates = await source.listTeamMemberUserIds(teamId, roles);
  } else if (scope === "board") {
    const roles = cleanRoles(feature.board_roles);
    const boardId = feature.board_id ?? "";
    if (roles.length === 0 || !isValidUserId(boardId)) return empty(scope);
    candidates = await source.listBoardMemberUserIds(boardId, roles);
  } else {
    return empty(scope || "unknown");
  }

  const unique = normalizeUserIds(candidates);
  if (unique.length === 0) return empty(scope);

  const existing = new Set(await source.filterExistingUserIds(unique));
  const userIds = unique.filter((id) => existing.has(id));

  return { userIds, totalResolved: userIds.length, scope };
}

/** Minimal structural type so this file stays dependency-free. */
interface SupabaseLike {
  from(table: string): any;
}

const CHUNK = 500;

/** Production data source backed by the service-role Supabase client. */
export function createSupabaseAudienceSource(client: SupabaseLike): AudienceDataSource {
  async function collect(table: string, build: (q: any) => any): Promise<string[]> {
    const { data, error } = await build(client.from(table).select("user_id"));
    if (error) throw new Error(`[resolveFeatureAudience] ${table}: ${error.message}`);
    return (data ?? []).map((row: { user_id: string | null }) => row?.user_id ?? null);
  }

  return {
    listGlobalRoleUserIds: (roles) => collect("user_roles", (q) => q.in("role", roles)),
    listTeamMemberUserIds: (teamId, roles) =>
      collect("team_members", (q) => q.eq("team_id", teamId).in("role", roles)),
    listBoardMemberUserIds: (boardId, roles) =>
      collect("board_members", (q) => q.eq("board_id", boardId).in("role", roles)),
    async filterExistingUserIds(userIds) {
      const found: string[] = [];
      for (let i = 0; i < userIds.length; i += CHUNK) {
        const slice = userIds.slice(i, i + CHUNK);
        const { data, error } = await client.from("profiles").select("id").in("id", slice);
        if (error) throw new Error(`[resolveFeatureAudience] profiles: ${error.message}`);
        for (const row of data ?? []) if (row?.id) found.push(row.id as string);
      }
      return found;
    },
  };
}
