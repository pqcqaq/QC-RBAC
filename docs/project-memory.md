# Project Memory

Last updated: 2026-03-20

## 1. Project goal

This repository is a production-oriented RBAC monorepo starter, not a toy demo. The target is a reusable foundation that already includes:

- backend RBAC auth, permission checks, CRUD, audit, upload, realtime
- a formal Web admin console with scalable frontend architecture
- a mobile client based on official unibest
- a shared `api-common` package for Web and uni-app request reuse

The project should remain easy to continue over multiple sessions without re-explaining the original requirements.

## 2. User requirements that must not be broken

### Monorepo structure

- `apps/backend`
- `packages/api-common`
- `apps/web-frontend`
- `apps/app-frontend`

### Fixed stack constraints

- Web: Vue 3 + TypeScript + Element Plus + Pinia + Vue Router + Vite 8
- Backend: Node.js + Express + TypeScript + Prisma + PostgreSQL + Redis + JWT + bcrypt + Multer + OSS + Socket.io
- App: must be based on official unibest structure; do not replace it with a custom uni-app scaffold
- Shared API: `api-common` must provide a custom request layer usable in both Web and uni-app environments

### Product expectations

- This is not allowed to stay at "simple CRUD demo" quality
- Web admin must feel like a complete management console
- RBAC core must be real and database-backed
- User / Role / Permission / Audit must support real CRUD and practical management flows
- The interface must support permission-source tracing, role-permission management, and a professional layout system

## 3. Current implemented state

## 3.1 Monorepo

- `apps/backend`: implemented and tested
- `packages/api-common`: implemented and shared by backend/web/app
- `apps/web-frontend`: implemented with mature admin-shell direction
- `apps/app-frontend`: based on unibest and integrated with shared request/token logic

## 3.2 Backend

Implemented:

- register / login / refresh / logout / current user
- RBAC permission guard
- users / roles / permissions full CRUD
- user permission-source analysis
- dashboard summary
- audit logs
- avatar upload
- Socket.io realtime channel
- Redis-backed session / permission-related flow

Verification status:

- `pnpm --filter @rbac/backend test` passes

## 3.3 Web admin

Implemented:

- login flow and route guard
- standard admin shell: header + sidebar or top-nav + tabs + main + footer
- settings drawer with local persistence
- theme preset switching
- layout mode switching
- keep-alive tab/workbench persistence
- metadata-driven page registry via `import.meta.glob`
- unified page scaffold for main admin pages
- standardized `users / roles / permissions / audit`
- dashboard / explorer / live pages aligned into the same shell system

Verification status:

- `pnpm --filter @rbac/web-frontend build` passes

## 3.4 App frontend

Implemented direction:

- unibest-based project structure retained
- shared `api-common` adaptor integrated
- token/request customization added on top of unibest
- mobile login / permission-related entry already connected

Constraint:

- future work must keep following the official unibest organization style

## 4. Important architecture decisions

## 4.1 Ports

- backend default port is `3300`
- this was intentionally unified because local `3000` was already occupied
- Web and App request defaults were already updated to use `3300`

Do not casually switch back to `3000` unless the whole repo config is updated together.

## 4.2 Shared request layer

`packages/api-common` is the cross-platform request core.

Responsibilities:

- shared API factory
- shared DTO/types
- fetch adaptor for Web
- uni adaptor for uni-app
- request-level reuse across Web and App

If `api-common` changes, always rebuild it and verify dependents.

## 4.3 Web page metadata system

The Web admin now uses page-level metadata as a framework primitive.

Key files:

- `apps/web-frontend/src/meta/pages.ts`
- `apps/web-frontend/src/meta/pages/*.json`

The metadata currently drives:

- navigation list
- route registration
- page title / caption / description / code
- permission binding
- keep-alive behavior

Future pages should keep following this pattern instead of hardcoding nav config in multiple places.

## 4.4 Web workbench architecture

Key files:

- `apps/web-frontend/src/stores/workbench.ts`
- `apps/web-frontend/src/components/workbench/PageScaffold.vue`
- `apps/web-frontend/src/components/workbench/SurfacePanel.vue`
- `apps/web-frontend/src/components/workbench/WorkbenchTabs.vue`
- `apps/web-frontend/src/components/workbench/WorkbenchSettings.vue`
- `apps/web-frontend/src/composables/use-page-state.ts`

Current responsibilities:

- theme preset persistence
- layout mode persistence
- visited tabs persistence
- keep-alive cache control
- page-local state persistence
- standardized page skeleton and panel composition

This is an intentional move toward a true admin-template architecture, not one-off pages.

## 4.5 Theme system

Key files:

- `apps/web-frontend/src/themes/presets/*.json`
- `apps/web-frontend/src/themes/index.ts`
- `apps/web-frontend/vite/theme-presets.ts`
- `apps/web-frontend/src/themes/styles/_tokens.scss`
- `apps/web-frontend/src/styles/main.scss`

Current behavior:

- theme presets are defined as JSON
- Vite virtual module generates the runtime preset list
- runtime applies CSS variables to `document.documentElement`
- global styles are split into modular SCSS layers

This should remain the basis for future theme and design-system work.

## 4.6 Element Plus usage

Current direction:

- global visual overrides are applied via token/style architecture
- `App.vue` uses `el-config-provider`
- Vite now uses auto-import/component auto-registration for Element Plus
- Web entry no longer mounts Element Plus as a heavy global plugin

Reason:

- better maintainability
- smaller build output
- closer to a reusable admin template baseline

## 5. Current documentation and source of truth

Start here when resuming work:

1. `README.md`
2. `docs/project-memory.md`
3. `docs/plans/2026-03-20-rbac-monorepo-design.md`

Then inspect these implementation anchors if needed:

- backend: `apps/backend`
- shared API: `packages/api-common`
- web shell: `apps/web-frontend/src/layouts/ShellLayout.vue`
- page metadata: `apps/web-frontend/src/meta/pages.ts`
- workbench state: `apps/web-frontend/src/stores/workbench.ts`

## 6. Development workflow to continue this project

## 6.1 Before changing code

- read this document and `README.md`
- keep the monorepo boundaries intact
- preserve unibest structure in `apps/app-frontend`
- preserve metadata-driven Web admin architecture
- prefer extending the shared abstractions instead of adding duplicated page logic

## 6.2 During implementation

- keep changes small and composable
- prefer framework-level improvements over page-only patches when repetition appears
- maintain real backend data flow; do not replace live data with mock data
- when adding admin pages, register them through metadata JSON first
- when adding persistent page behavior, use `usePageState`

## 6.3 After implementation

Minimum verification rules:

- if backend changed: run `pnpm --filter @rbac/backend test`
- if web changed: run `pnpm --filter @rbac/web-frontend build`
- if `api-common` changed: run `pnpm --filter @rbac/api-common build`, then verify web/backend/app as needed
- if app changed: run `pnpm --filter @rbac/app-frontend type-check` and related app build/dev verification

Recommended install command:

```bash
pnpm --store-dir .pnpm-store install
```

## 7. Known active direction for next work

The project has already moved beyond basic CRUD, but the intended direction is still to make the Web admin more framework-like.

Recommended next steps:

- continue schema/config-driven CRUD abstraction to reduce page duplication
- further standardize table columns / form items / detail drawer definitions
- continue improving app-side management experience while keeping unibest conventions
- expand project docs as architecture grows

## 8. Non-negotiable continuation rules

- backend RBAC must stay real and database-backed
- app frontend must stay unibest-based
- Web admin should keep the current formal admin-shell direction
- page registration should continue using metadata + glob loading
- shared request/type logic should continue to live in `packages/api-common`
- verification should always be run on changed subprojects before considering work complete
