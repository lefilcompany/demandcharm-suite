# AGENTS.md — technical decisions

One rule per decision, with the reason.

## PWA / service worker

- The service worker is hand-written in `src/sw.ts` (vite-plugin-pwa `injectManifest`), not generated from config — because the hosting deletes the previous hashed files on every publish, so caching behaviour must be explicit and auditable.
- `index.html` is never precached; navigations use NetworkFirst with a single cache key (`<scope>index.html`) used only as an offline fallback — a stale page points to deleted chunks (404 → blank screen).
- Same-origin `/assets/*` requests go through a CacheFirst route that writes into the precache cache — so a partial or wiped cache self-heals from the network.
- Heavy on-demand vendor chunks (shiki, mermaid and their dependencies, see `LAZY_VENDOR_RE` in `vite.config.ts`) are emitted under `assets/lazy/` and excluded from the precache — they were ~19 MB per publish for every user; cached at runtime only when used.
- The precache contains only JS/CSS/icons/fonts: no HTML, no JSON (`build-info.json` and `release-manifest.json` must always be fresh for release detection) and no raster images (runtime `images-cache` covers them).
- Updates stay in `prompt` mode (`UpdateModal`), but the update flow must not delete caches — the new worker cleans the previous version on activate; wiping the precache left the app with no offline copy.
- `src/lib/chunkReload.ts` is the single recovery path for missing-chunk errors: activate a waiting worker if any, then reload once (30 s guard). `AppErrorBoundary` in `main.tsx` is the last line of defence so the screen is never blank.
- Backend reads (`/rest/v1/` GET) are the only API responses the worker may store, with NetworkFirst and **no network timeout**, cache keys scoped per user (`src/lib/swApiCache.ts` appends the JWT `sub`), and anonymous requests never cached — a URL-only key with a 10 s timeout served empty/other-account lists to signed-in users ("all my projects disappeared"). Auth, Edge Functions and realtime are never cached.

## Data lists

- A list screen must never render its "empty" state when the query failed: show an error state with a retry (`Projects.tsx`, `DemandFolderStrip.tsx`) — a masked network error reads as "my data was deleted".
- Query keys for data whose shape depends on the signed-in user (e.g. `is_owner` in `useDemandFolders`) must include the user id, so one account's cached result is never reused by another.

## Sprints

- Sprint progress uses `sprintKanbanCompletion` for current delivered statuses and `sprintStageDistribution` for stage occupancy, from the same demands and columns as the Kanban — separate completion and distribution bars prevent intermediate stages or historical delivery timestamps from implying completed work.
- Sprints belong to one board (`board_sprints` + `sprint_demands`); the "one open sprint per demand" and "one active sprint per board" rules live in the database (trigger + partial unique index) so every client obeys them; the sprint Kanban reuses `KanbanBoard` with the board demands filtered by sprint so drag/status logic stays in one place.
- Hiding old delivered demands is a Kanban-page-only filter (`src/lib/kanbanVisibility.ts` + `boards.kanban_cleared_at`, set by RPC `clear_board_kanban`); `useDemands`/`demands-read` stay unfiltered because the demand list, reports and sprints share them.

## Kanban stages

- Every non-archived demand must sit in a stage whose name is active on its board, because the Kanban groups cards by stage name and silently drops the rest: trigger `a0_keep_demand_on_active_stage` (runs first among BEFORE triggers) remaps writes via `resolve_board_demand_status`, and `guard_board_stage_deactivation` refuses to switch off a stage that still holds demands (`STAGE_HAS_DEMANDS`) — the UI then calls RPC `deactivate_board_stage`, which moves them to a chosen non-timer stage and deactivates in one transaction.
- Bulk stage moves set local flag `soma.bulk_stage_move = on` so `notify_demand_status_changed` skips per-demand notifications.

## Admin impersonation

- System admins enter a user's account only through Edge `admin-impersonate` (checks `has_role admin`, refuses other admins, writes `admin_impersonation_log` before issuing a one-time login token); `src/lib/impersonation.ts` keeps the admin refresh token locally to return — so every access is server-checked and auditable.
- The sprint "Ficha" PDF builds its diffs only from stored records (`sprint_demands.added_at`, `demand_due_date_changes`, `delivered_at`, `status_changed_at`) in pure `src/lib/sprintDevSheet.ts`; the "Agora é possível" list comes from Edge `sprint-release-notes`, which reads delivered demands under the caller's RLS — so the sheet never invents history and never leaks other boards.

## Sprint artifacts

- Sprint/board documents live in `board_artifacts` + private bucket `sprint-artifacts` (path `<board_id>/<artifact_id>/<file>`, so storage RLS reuses `is_board_member`/`can_edit_board_sprints` on the first folder); ADR numbering per board and "accepted ADR is immutable" are enforced by trigger `trg_board_artifact_rules`, so every client obeys them. Completed sprints archive the PDF sheet and Excel list from the client after `complete_sprint`, never blocking completion.

## Release news

- Product-update clicks in the notification dropdown and toast stack use `notificationNewsBus` to open the shared `NotificationNewsDialog` with the recipient's stored notification text; the CTA stays separate from reading, avoiding new access to admin-only release tables.

## Board assistant actions

- The assistant reads its board catalog live on every request through `board-agent/catalog.ts` and supplies it as authoritative model context as well as a tool result; query failures abort rather than masquerade as no services, and `board-agent/history.ts` strips stale read-tool results (and, when services exist, old "no services" answers) from earlier turns, so stale conversation claims cannot block creation.

- Assistant mutations use AI SDK manual approval with a server-signed input bound to user/board, then `execute_board_agent_action` (SECURITY INVOKER) validates live role/scope and commits changes plus per-user tool-call receipts atomically; replay returns the same result instead of duplicate demands/comments, while diagnostics keep canonical board metrics and explicitly flag incomplete history/sample limits.
- Chat document attachments reuse the document-import extraction and review dialog pinned to the current board, with extracted text supplied as untrusted chat context; original files are not persisted, and demand creation still requires selecting valid reviewed rows and explicitly submitting them.

## Financial intelligence

- In the finance module each board is a project; access is a separate capability layer (`finance_permissions`, checked by `has_finance_permission`) that no team or board role grants automatically, grants/revokes go only through RPCs that forbid self-grants and log to `finance_audit_log`, and requesters are always excluded — so operational roles never leak salaries or margins.
- Finance screens read aggregates only from RPC `get_finance_overview` (authorized boards only, team cost never per person) and compute results with the pure `src/lib/finance/engine.ts`, so formulas stay identical everywhere and confidential rows never reach unauthorized clients.
- Shared expenses (`finance_expenses.board_id IS NULL` + `allocation_method`) are split across boards at read time by internal `_finance_allocations` (mirrored in pure `src/lib/finance/allocation.ts`), using all team boards as the base so shares never depend on the viewer; an expense is either direct or shared (CHECK), rounding cents go to the largest share, and zero-base amounts stay "unallocated" instead of vanishing.
- Pricing scenarios store only aggregate, versioned assumptions in `finance_scenarios`, never employee planning rows; RLS requires authorized board reads plus revenue-management for writes, immutable scope prevents reassignment, and CSV uses audited `export_finance_scenarios` with per-board export checks. `simulator.ts` calculates variable costs once and reuses the financial engine so estimates never mutate operational or actual financial records.
- Monthly closing stores a per-board snapshot (`finance_periods` + `finance_period_snapshots`, built by `finance_close_period` from viewer-independent `_finance_overview_all`); `get_finance_overview` serves closed months from snapshot + insert-only `finance_period_adjustments`, and trigger `finance_guard_closed_period` refuses edits to entries of closed months — so closed numbers never change silently and corrections stay auditable. Checklist rules live in `_finance_close_checklist`, mirrored for display in pure `src/lib/finance/closing.ts`.

## Auth / sessão

- A renovação de token é exclusiva do `autoRefreshToken` do supabase-js (que tem trava interna); nunca adicionar timers, handlers de `visibilitychange`/`online` ou outras chamadas manuais de `refreshSession` em `auth.tsx` — o preview do Lovable mantém uma segunda cópia da sessão no editor (broker postMessage), e refreshes concorrentes com o mesmo refresh token de uso único revogam a sessão inteira (401 em tudo).

## Financial projects

- A project (`projects`) is the financial cost centre and may group several boards over time (`project_boards` with validity); each demand has one financial destination per month in `finance_demand_attributions` (unique per demand+competence), set automatically by trigger only when its board is in exactly one finance-enabled project, otherwise `pending` — manual choices via RPC `finance_assign_demand` are never overwritten, so hours are never counted twice. Member employment kind lives in `finance_member_profiles` with non-overlapping validity, independent of team/board roles.

- Project hours come only from `_finance_time_slices` (mirror: `src/lib/finance/timeSlices.ts`): cut at São Paulo month boundaries, a person's overlapping timers counted once, missing hourly cost reported as missing (never zero); `get_project_hours_costs` shows per-person rows only with `finance.view_employee_costs` — so cost is never duplicated or hidden.
