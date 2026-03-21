# Project Memory

Last updated: 2026-03-22

## 1. Project goal

This repository is a production-oriented RBAC monorepo starter, not a toy CRUD demo. The intended outcome is a reusable admin/business foundation that already includes:

- a real backend RBAC service
- a professional web admin console
- an app client that stays on official unibest structure
- a shared `api-common` package for cross-platform request/type reuse
- a backend timer registry for scheduled tasks

## 2. Fixed boundaries and stack

### Monorepo structure

- `apps/backend`
- `packages/api-common`
- `apps/web-frontend`
- `apps/app-frontend`

### Stack constraints

- Web: Vue 3 + TypeScript + Element Plus + Pinia + Vue Router + Vite 8
- Backend: Node.js + Express + TypeScript + Prisma + PostgreSQL + Redis + JWT + bcrypt + S3-compatible object storage + Socket.io
- Backend timers: `apps/backend/src/timers` + `toad-scheduler`
- App: must remain based on official unibest structure
- Shared API: `packages/api-common` remains the shared request/type layer for Web and App

### Product constraints

- RBAC must stay real and database-backed
- Web admin must keep evolving as a coherent management framework
- Menu, permission, upload, and audit flows must remain production-minded
- Shared abstractions should be preferred over repeated page-local logic

## 3. Current implemented state

### 3.1 Backend

Implemented:

- auth: register / login / refresh / logout / current user
- RBAC permission guard and permission-source analysis
- users / roles / permissions / audit log CRUD and queries
- menu tree CRUD and current-user accessible menu tree
- dashboard summary and realtime channel
- S3-compatible upload flow with pre-sign creation and upload callback
- file records extended for direct upload and multipart upload tracking

### 3.2 Backend timers

Implemented:

- dedicated hourly upload reconciliation in `apps/backend/src/timers`
- unfinished single-part upload state checking against S3
- conservative multipart behavior that leaves partial multipart uploads untouched until completed by normal flow

### 3.3 Web admin

Implemented:

- login flow and route guard
- admin shell with sidebar or top-navigation layout
- responsive sidebar collapse behavior
- integrated header + cached tabs workbench model
- persistent workbench settings:
  - theme preset
  - layout mode
  - sidebar appearance
  - page transition
  - cached-tab display mode
- `definePage(...)` page-local metadata macro with virtual page registry
- backend-driven menu/navigation tree loaded after login
- modal-based menu management with permission binding and icon selection
- generic `ContextMenuHost` abstraction used by list pages and workbench tabs
- workbench tabs with close-on-context-menu and middle-click close
- route description shown in header instead of duplicated inside page bodies
- dev-only Vue devtools plugin integration

### 3.4 App frontend

Current direction:

- official unibest structure preserved
- shared `api-common` adaptor integrated
- token/request customization added without replacing unibest architecture

## 4. Important architecture decisions

### 4.1 Ports

- backend default port is `3300`
- Web and App request defaults were aligned to this port

Do not change ports casually without updating the whole repo together.

### 4.2 Shared request layer

`packages/api-common` owns:

- shared API factory
- shared DTO/types
- fetch adaptor for Web
- uni adaptor for App

If `api-common` changes, rebuild it and then verify dependents.

### 4.3 Upload architecture

The upload system is now based on direct-to-S3-compatible storage.

Current model:

- backend creates file records and returns upload instructions
- browser uploads directly to object storage
- backend callback finalizes the result
- backend timers reconcile stuck single-part uploads

This architecture should remain the default for future upload features.

### 4.4 Navigation ownership

The backend menu table is now the source of truth for:

- navigation hierarchy
- menu ordering
- menu icons
- route path ownership
- permission attachment for pages/actions

`definePage(...)` is only for page-local metadata such as title, caption, description, keep-alive, and cache naming. Do not move navigation ownership back into scattered page JSON files.

### 4.5 Web workbench architecture

Key anchors:

- `apps/web-frontend/src/layouts/ShellLayout.vue`
- `apps/web-frontend/src/stores/workbench.ts`
- `apps/web-frontend/src/components/workbench/PageScaffold.vue`
- `apps/web-frontend/src/components/workbench/WorkbenchTabs.vue`
- `apps/web-frontend/src/components/workbench/WorkbenchSettings.vue`
- `apps/web-frontend/src/components/common/ContextMenuHost.vue`
- `apps/web-frontend/src/meta/page-definition.ts`

The workbench owns persistent UI behavior and should remain the place for shell-level preferences and interactions.

### 4.6 Theme and layout system

Key anchors:

- `apps/web-frontend/src/themes/index.ts`
- `apps/web-frontend/src/themes/styles/_tokens.scss`
- `apps/web-frontend/src/styles/_shell.scss`
- `apps/web-frontend/src/styles/_workbench.scss`

The current direction is a denser, more integrated admin-shell style. When fixing visual rhythm, prefer shared token/shell/workbench changes before page-specific overrides.

## 5. Documentation and source of truth

Start here when resuming work:

1. `README.md`
2. `docs/project-memory.md`
3. `docs/implementation-history.md`
4. `docs/development-guidelines.md`
5. `docs/plans/2026-03-20-rbac-monorepo-design.md`

Then inspect these implementation anchors if needed:

- backend menu APIs: `apps/backend/src/routes/menus.ts`
- backend menu service: `apps/backend/src/services/menu-tree.ts`
- backend timer registry: `apps/backend/src/timers/index.ts`
- web shell: `apps/web-frontend/src/layouts/ShellLayout.vue`
- page definition macro: `apps/web-frontend/src/meta/page-definition.ts`
- workbench state: `apps/web-frontend/src/stores/workbench.ts`

## 6. Verification workflow

- backend: `pnpm --filter @rbac/backend lint` and `pnpm --filter @rbac/backend test`
- web: `pnpm --filter @rbac/web-frontend lint` and `pnpm --filter @rbac/web-frontend build`
- api-common: `pnpm --filter @rbac/api-common lint` and `pnpm --filter @rbac/api-common build`
- app: `pnpm --filter @rbac/app-frontend type-check`

## 7. Non-negotiable continuation rules

- backend RBAC must stay real and database-backed
- app frontend must stay unibest-based
- backend menu tree remains the source of truth for navigation and page/action permission binding
- `definePage(...)` remains the page-local metadata primitive
- shared request/type logic remains in `packages/api-common`
- background timers remain registered inside `apps/backend/src/timers`
- no `any`
- run the relevant verification commands before considering work complete
