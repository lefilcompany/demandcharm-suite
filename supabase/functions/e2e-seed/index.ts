// E2E seed/cleanup helper for plan-limit tests.
// SECURED by header `x-e2e-secret` matching env `E2E_SEED_SECRET`.
// Not deployed unless the secret exists. Do not call from production code.

import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-e2e-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const E2E_SECRET = Deno.env.get("E2E_SEED_SECRET") ?? "";

type PlanSlug = "starter" | "profissional" | "business" | "enterprise";
type Resource = "boards" | "members" | "demands" | "services" | "notes";

interface SeedBody {
  op: "seed" | "cleanup" | "extra_user";
  plan?: PlanSlug;
  /** Pre-fill the resource up to the plan limit (so the next attempt is blocked). */
  fill?: Resource | null;
  /** Cleanup */
  emails?: string[];
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function rand(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function genAccessCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // Refuse to run in production. Detection order:
  // 1) Explicit ENVIRONMENT=production|live secret (highest priority, allows ops to force-disable).
  // 2) Project-ref allowlist: only the known Test/Dev Supabase project may run this function.
  //    Live has a different SUPABASE_URL, so this naturally blocks the production deployment
  //    even though the E2E_SEED_SECRET is synced across environments on publish.
  const environment = (Deno.env.get("ENVIRONMENT") ?? "").toLowerCase();
  if (environment === "production" || environment === "live" || environment === "prod") {
    return json(503, { error: "e2e_disabled", message: "e2e-seed is disabled in production" });
  }
  const TEST_PROJECT_REFS = new Set<string>(["dcojvsftpzwfhgvamdgm"]);
  const url = SUPABASE_URL ?? "";
  const refMatch = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  const projectRef = refMatch?.[1] ?? "";
  const isKnownTestProject = TEST_PROJECT_REFS.has(projectRef);
  const isExplicitTestEnv = environment === "test" || environment === "e2e" || environment === "staging";
  if (!isKnownTestProject && !isExplicitTestEnv) {
    return json(503, { error: "e2e_disabled", message: "e2e-seed is only available in test environments" });
  }

  if (!E2E_SECRET) return json(503, { error: "e2e_disabled", message: "E2E_SEED_SECRET not configured" });
  const provided = req.headers.get("x-e2e-secret") ?? "";
  if (provided !== E2E_SECRET) return json(401, { error: "unauthorized" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: SeedBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  try {
    if (body.op === "cleanup") {
      const emails = body.emails ?? [];
      const removed: string[] = [];
      for (const email of emails) {
        // list users matching email
        const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
        const user = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (user) {
          // delete teams created by this user (cascade nukes everything tied to them)
          await admin.from("teams").delete().eq("created_by", user.id);
          await admin.auth.admin.deleteUser(user.id);
          removed.push(email);
        }
      }
      return json(200, { ok: true, removed });
    }

    if (body.op === "extra_user") {
      const email = `e2e+${rand("u")}@soma.test`;
      const password = "E2eTest!" + crypto.randomUUID().slice(0, 8);
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: "E2E Extra" },
      });
      if (cErr) throw cErr;
      return json(200, { ok: true, email, password, userId: created.user!.id });
    }

    if (body.op !== "seed") return json(400, { error: "invalid_op" });

    const planSlug: PlanSlug = body.plan ?? "starter";
    const fill = body.fill ?? null;

    // Resolve plan
    const { data: plan, error: planErr } = await admin
      .from("plans")
      .select("id, name, slug, max_boards, max_members, max_demands_per_month, max_services, max_notes")
      .eq("slug", planSlug)
      .maybeSingle();
    if (planErr || !plan) return json(400, { error: "plan_not_found", planSlug });

    // 1) Owner user
    const email = `e2e+${rand("owner")}@soma.test`;
    const password = "E2eTest!" + crypto.randomUUID().slice(0, 8);
    const { data: u, error: uErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "E2E Owner" },
    });
    if (uErr) throw uErr;
    const userId = u.user!.id;

    // ensure profile
    await admin.from("profiles").upsert({ id: userId, full_name: "E2E Owner", email });

    // 2) Team
    const accessCode = genAccessCode();
    const { data: team, error: tErr } = await admin
      .from("teams")
      .insert({ name: `E2E Team ${rand("t")}`, access_code: accessCode, created_by: userId, active: true })
      .select("id, access_code")
      .single();
    if (tErr) throw tErr;
    const teamId = team.id as string;

    // 3) Subscription (active, current month) -> attach plan
    await admin.from("subscriptions").insert({
      team_id: teamId,
      plan_id: plan.id,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 31 * 86400_000).toISOString(),
    });

    // 4) Owner as team_members (admin role)
    await admin.from("team_members").insert({ team_id: teamId, user_id: userId, role: "admin" });

    // 5) Default board + 5 base stages
    const { data: board, error: bErr } = await admin
      .from("boards")
      .insert({ team_id: teamId, name: "Quadro Padrão", created_by: userId, is_default: true })
      .select("id")
      .single();
    if (bErr) throw bErr;
    const boardId = board.id as string;

    // Add owner to the board as admin
    await admin
      .from("board_members")
      .insert({ board_id: boardId, user_id: userId, role: "admin", added_by: userId });

    // Resolve any 5 generic statuses and attach to board (best-effort; UI uses board_statuses).
    const { data: statuses } = await admin
      .from("demand_statuses")
      .select("id, name")
      .or("board_id.is.null,is_system.eq.true")
      .limit(5);
    if (statuses && statuses.length > 0) {
      await admin.from("board_statuses").insert(
        statuses.map((s, i) => ({
          board_id: boardId,
          status_id: s.id,
          position: i,
          is_active: true,
        }))
      );
    }

    // 6) Pre-fill resource up to plan limit (the trigger naturally allows up to limit-1 inserts)
    const extraEmails: string[] = [];
    if (fill) await fillResource(admin, { fill, plan, teamId, boardId, userId, extraEmails });

    // First status id for this board (for demand inserts in tests if needed)
    const { data: bStatuses } = await admin
      .from("board_statuses")
      .select("status_id")
      .eq("board_id", boardId)
      .order("position", { ascending: true })
      .limit(1);
    const firstStatusId = bStatuses?.[0]?.status_id ?? null;

    return json(200, {
      ok: true,
      email,
      password,
      userId,
      teamId,
      boardId,
      accessCode,
      planName: plan.name,
      planSlug: plan.slug,
      firstStatusId,
      extraEmails,
    });
  } catch (e) {
    console.error("e2e-seed error", e);
    return json(500, { error: "seed_failed", message: (e as Error).message });
  }
});

async function fillResource(
  admin: ReturnType<typeof createClient>,
  args: {
    fill: Resource;
    plan: { name: string; max_boards: number; max_members: number; max_demands_per_month: number; max_services: number; max_notes: number };
    teamId: string;
    boardId: string;
    userId: string;
    extraEmails: string[];
  }
) {
  const { fill, plan, teamId, boardId, userId, extraEmails } = args;

  if (fill === "boards") {
    // owner already has 1 default board. Insert (max_boards - 1) more so total = max.
    for (let i = 1; i < plan.max_boards; i++) {
      await admin.from("boards").insert({
        team_id: teamId,
        name: `Quadro Extra ${i}`,
        created_by: userId,
        is_default: false,
      });
    }
    return;
  }

  if (fill === "members") {
    // owner already in team_members; add (max_members - 1) more users
    for (let i = 1; i < plan.max_members; i++) {
      const email = `e2e+${args.teamId.slice(0, 6)}m${i}@soma.test`;
      const password = "E2eTest!" + crypto.randomUUID().slice(0, 8);
      const { data: u } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (u?.user) {
        await admin.from("profiles").upsert({ id: u.user.id, full_name: `E2E M${i}`, email });
        await admin.from("team_members").insert({ team_id: teamId, user_id: u.user.id, role: "executor" });
        extraEmails.push(email);
      }
    }
    return;
  }

  if (fill === "demands") {
    const { data: bStatuses } = await admin
      .from("board_statuses")
      .select("status_id")
      .eq("board_id", boardId)
      .order("position", { ascending: true })
      .limit(1);
    const statusId = bStatuses?.[0]?.status_id;
    if (!statusId) return;
    for (let i = 0; i < plan.max_demands_per_month; i++) {
      await admin.from("demands").insert({
        team_id: teamId,
        board_id: boardId,
        title: `E2E Demanda ${i + 1}`,
        status_id: statusId,
        created_by: userId,
        priority: "média",
      });
    }
    return;
  }

  if (fill === "services") {
    for (let i = 0; i < plan.max_services; i++) {
      await admin.from("services").insert({
        team_id: teamId,
        name: `E2E Serviço ${i + 1}`,
        estimated_hours: 1,
        created_by: userId,
      });
    }
    return;
  }

  if (fill === "notes") {
    // max_notes might be 0 (starter) — nothing to fill; first creation already blocks
    for (let i = 0; i < plan.max_notes; i++) {
      await admin.from("notes").insert({
        team_id: teamId,
        title: `E2E Nota ${i + 1}`,
        created_by: userId,
      });
    }
    return;
  }
}
