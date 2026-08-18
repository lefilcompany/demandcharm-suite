import { describe, it, expect } from "vitest";
import {
  resolveFeatureAudience,
  normalizeUserIds,
  type AudienceDataSource,
  type FeatureAudienceInput,
} from "../../supabase/functions/_shared/resolveFeatureAudience";

const ADMIN = "11111111-1111-4111-8111-111111111111";
const MOD = "22222222-2222-4222-8222-222222222222";
const EXEC = "33333333-3333-4333-8333-333333333333";
const REQ = "44444444-4444-4444-8444-444444444444";
const GHOST = "55555555-5555-4555-8555-555555555555";
const TEAM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOARD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

interface Rows {
  userRoles?: Array<{ user_id: string; role: string }>;
  teamMembers?: Array<{ user_id: string; team_id: string; role: string }>;
  boardMembers?: Array<{ user_id: string; board_id: string; role: string }>;
  profiles?: string[];
}

function makeSource(rows: Rows) {
  const calls = { global: 0, team: 0, board: 0, profiles: 0 };
  const source: AudienceDataSource = {
    async listGlobalRoleUserIds(roles) {
      calls.global++;
      return (rows.userRoles ?? []).filter((r) => roles.includes(r.role)).map((r) => r.user_id);
    },
    async listTeamMemberUserIds(teamId, roles) {
      calls.team++;
      return (rows.teamMembers ?? [])
        .filter((r) => r.team_id === teamId && roles.includes(r.role))
        .map((r) => r.user_id);
    },
    async listBoardMemberUserIds(boardId, roles) {
      calls.board++;
      return (rows.boardMembers ?? [])
        .filter((r) => r.board_id === boardId && roles.includes(r.role))
        .map((r) => r.user_id);
    },
    async filterExistingUserIds(ids) {
      calls.profiles++;
      const existing = rows.profiles ?? [ADMIN, MOD, EXEC, REQ];
      return ids.filter((id) => existing.includes(id));
    },
  };
  return { source, calls };
}

const base: FeatureAudienceInput = { audience_scope: "global", global_roles: ["admin"] };

describe("resolveFeatureAudience", () => {
  it("global: returns only global admins", async () => {
    const { source, calls } = makeSource({
      userRoles: [
        { user_id: ADMIN, role: "admin" },
        { user_id: MOD, role: "member" },
      ],
    });
    const result = await resolveFeatureAudience(base, source);
    expect(result).toEqual({ userIds: [ADMIN], totalResolved: 1, scope: "global" });
    expect(calls.global).toBe(1);
    expect(calls.profiles).toBe(1);
  });

  it("team: returns only admin/moderator members of that team", async () => {
    const { source } = makeSource({
      teamMembers: [
        { user_id: ADMIN, team_id: TEAM, role: "admin" },
        { user_id: MOD, team_id: TEAM, role: "moderator" },
        { user_id: EXEC, team_id: TEAM, role: "executor" },
        { user_id: REQ, team_id: "other-team", role: "admin" },
      ],
    });
    const result = await resolveFeatureAudience(
      { audience_scope: "team", team_id: TEAM, team_roles: ["admin", "moderator"] },
      source,
    );
    expect(result.userIds.sort()).toEqual([ADMIN, MOD].sort());
    expect(result.totalResolved).toBe(2);
    expect(result.scope).toBe("team");
  });

  it("board: returns executors and requesters of that board only", async () => {
    const { source } = makeSource({
      boardMembers: [
        { user_id: EXEC, board_id: BOARD, role: "executor" },
        { user_id: REQ, board_id: BOARD, role: "requester" },
        { user_id: ADMIN, board_id: BOARD, role: "admin" },
        { user_id: MOD, board_id: "other-board", role: "executor" },
      ],
    });
    const result = await resolveFeatureAudience(
      { audience_scope: "board", board_id: BOARD, board_roles: ["executor", "requester"] },
      source,
    );
    expect(result.userIds.sort()).toEqual([EXEC, REQ].sort());
    expect(result.totalResolved).toBe(2);
  });

  it("user without access is never returned", async () => {
    const { source } = makeSource({
      boardMembers: [{ user_id: REQ, board_id: BOARD, role: "requester" }],
    });
    const result = await resolveFeatureAudience(
      { audience_scope: "board", board_id: BOARD, board_roles: ["executor"] },
      source,
    );
    expect(result).toEqual({ userIds: [], totalResolved: 0, scope: "board" });
  });

  it("dedupes a user present in two memberships", async () => {
    const { source } = makeSource({
      boardMembers: [
        { user_id: EXEC, board_id: BOARD, role: "executor" },
        { user_id: EXEC, board_id: BOARD, role: "requester" },
      ],
    });
    const result = await resolveFeatureAudience(
      { audience_scope: "board", board_id: BOARD, board_roles: ["executor", "requester"] },
      source,
    );
    expect(result.userIds).toEqual([EXEC]);
    expect(result.totalResolved).toBe(1);
  });

  it("ignores non-existent users and invalid memberships", async () => {
    const { source } = makeSource({
      userRoles: [
        { user_id: ADMIN, role: "admin" },
        { user_id: GHOST, role: "admin" },
        { user_id: "not-a-uuid", role: "admin" },
      ],
      profiles: [ADMIN, MOD, EXEC, REQ],
    });
    const result = await resolveFeatureAudience(base, source);
    expect(result.userIds).toEqual([ADMIN]);
  });

  it("returns empty audience for missing scope config", async () => {
    const { source, calls } = makeSource({});
    expect(await resolveFeatureAudience({ audience_scope: "team", team_roles: ["admin"] }, source))
      .toEqual({ userIds: [], totalResolved: 0, scope: "team" });
    expect(await resolveFeatureAudience({ audience_scope: "global", global_roles: [] }, source))
      .toEqual({ userIds: [], totalResolved: 0, scope: "global" });
    expect(calls.profiles).toBe(0);
  });

  it("priority does not affect the audience", async () => {
    const { source } = makeSource({ userRoles: [{ user_id: ADMIN, role: "admin" }] });
    const low = await resolveFeatureAudience({ ...base, ...({ priority: "low" } as object) }, source);
    const high = await resolveFeatureAudience({ ...base, ...({ priority: "critical" } as object) }, source);
    expect(low.userIds).toEqual(high.userIds);
  });

  it("normalizeUserIds removes duplicates and invalid values", () => {
    expect(normalizeUserIds([ADMIN, ADMIN, null, undefined, "", "abc"])).toEqual([ADMIN]);
  });
});
