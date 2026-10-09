# AGENTS.md — technical decisions

Rules for anyone (human or agent) changing this codebase. One rule per decision, with the reason.

## PWA / service worker

- The service worker is hand-written in `src/sw.ts` (vite-plugin-pwa `injectManifest`), not generated from config — because the hosting deletes the previous hashed files on every publish, so caching behaviour must be explicit and auditable.
- `index.html` is never precached; navigations use NetworkFirst with a single cache key (`<scope>index.html`) used only as an offline fallback — a stale cached page points to chunks that no longer exist on the server (404 → blank screen, only fixed with Ctrl+Shift+R).
- Same-origin `/assets/*` requests go through a CacheFirst route that writes into the precache cache — so a partial install or a wiped cache self-heals from the network instead of forcing full re-downloads.
- Heavy on-demand vendor chunks (shiki, mermaid and their dependencies, see `LAZY_VENDOR_RE` in `vite.config.ts`) are emitted under `assets/lazy/` and excluded from the precache — they were ~19 MB / ~690 files downloaded by every user at each publish; they are cached at runtime only when used.
- The precache contains only JS/CSS/icons/fonts: no HTML, no JSON (`build-info.json` and `release-manifest.json` must always be fresh for release detection) and no raster images (runtime `images-cache` covers them).
- Updates stay in `prompt` mode (`UpdateModal`), but the update flow must not delete caches — the new worker cleans the previous version on activate; wiping the precache left the app with no offline copy.
- `src/lib/chunkReload.ts` is the single recovery path for missing-chunk errors: activate a waiting worker if any, then reload once (30 s guard). `AppErrorBoundary` in `main.tsx` is the last line of defence so the screen is never blank.
- Backend reads (`/rest/v1/` GET) are the only API responses the worker may store, with NetworkFirst and **no network timeout**, cache keys scoped per user (`src/lib/swApiCache.ts` appends the JWT `sub`), and anonymous requests never cached — a URL-only key with a 10 s timeout served empty/other-account lists to signed-in users ("all my projects disappeared"). Auth, Edge Functions and realtime are never cached.

## Data lists

- A list screen must never render its "empty" state when the query failed: show an error state with a retry (`Projects.tsx`, `DemandFolderStrip.tsx`) — a masked network error reads as "my data was deleted".
- Query keys for data whose shape depends on the signed-in user (e.g. `is_owner` in `useDemandFolders`) must include the user id, so one account's cached result is never reused by another.

## Sprints

- Sprints belong to one board (`board_sprints` + `sprint_demands`); the "one open sprint per demand" and "one active sprint per board" rules live in the database (trigger + partial unique index) so every client obeys them; the sprint Kanban reuses `KanbanBoard` with the board demands filtered by sprint so drag/status logic stays in one place.
