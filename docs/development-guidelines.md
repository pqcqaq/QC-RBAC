# Development Guidelines

Last updated: 2026-03-21

These guidelines capture the patterns that should now be treated as the default development rules for this repository.

## 1. Architecture rules

- Keep the pnpm monorepo boundaries intact:
  - `apps/backend`
  - `apps/backend-jobs`
  - `apps/web-frontend`
  - `apps/app-frontend`
  - `packages/api-common`
- `packages/api-common` is the shared request/type boundary. If shared request contracts or DTOs change, rebuild it before validating dependents.
- `apps/app-frontend` must continue following official unibest structure. Extend it; do not replace its scaffold with a custom uni-app architecture.
- Prefer framework-level abstractions over page-local duplication. If the same pattern appears twice, look for a store, composable, shared component, or registry to centralize it.

## 2. Backend rules

- Keep RBAC real and database-backed. Do not downgrade flows to mock data or hardcoded permission checks.
- Route handlers should stay thin. Put tree assembly, upload state transitions, and similar business logic into services.
- New scheduled/background jobs belong in `apps/backend-jobs`, not inside the request-serving backend process.
- S3-compatible storage is the upload abstraction boundary. New storage features should stay compatible with the S3 client/presign model unless there is a strong architectural reason otherwise.

## 3. Navigation and page metadata rules

- The backend menu table is now the source of truth for:
  - navigation hierarchy
  - menu ordering
  - menu icons
  - route path ownership
  - page/action permission attachment
- Use `definePage(...)` inside page components for page-local metadata only:
  - keep-alive
  - cache name
  - title
  - caption
  - description
  - code
- Do not reintroduce page JSON files as the primary navigation source.
- When adding a new page, update both:
  - the page component metadata via `definePage(...)`
  - the backend menu/seed data so the page is reachable and permission-bound

## 4. Frontend shared abstraction rules

- Use `ContextMenuHost` for right-click actions instead of building one-off context menu logic in each page.
- Use `PageScaffold` and related workbench components for standard admin page structure instead of inventing bespoke wrappers per page.
- Use the workbench store for persistent UI preferences such as:
  - layout mode
  - sidebar appearance
  - page transitions
  - cached-tab display mode
- Use the UnoCSS icon system consistently. Menu icons should be stored as icon identifiers and rendered through the shared icon component path.

## 5. UX and layout rules

- Favor dense, professional admin-console spacing over oversized empty gutters.
- When tuning layout density, prefer changing shared layers in this order:
  - theme tokens
  - shell styles
  - workbench/page scaffold styles
- Destructive or structural menu management actions should prefer modal-based flows when inline editing becomes cognitively noisy.
- Keep sidebar, header, tabs, and content areas visually integrated. Avoid floating sections that feel disconnected from the shell.
- Maintain responsive behavior:
  - sidebar must collapse cleanly on narrower screens
  - header actions must not explode into multiple rows unnecessarily
  - cached tabs must remain horizontally navigable

## 6. TypeScript and code quality rules

- Do not use `any`.
- Keep TypeScript configuration current and remove deprecation warnings instead of suppressing them casually.
- Prefer explicit domain types from shared packages or local models over implicit object literals.
- Keep edits small and composable. Avoid broad rewrites when a targeted abstraction improvement is enough.

## 7. Verification rules

- Backend changes:
  - `pnpm --filter @rbac/backend lint`
  - `pnpm --filter @rbac/backend test`
- Backend jobs changes:
  - `pnpm --filter @rbac/backend-jobs lint`
  - `pnpm --filter @rbac/backend-jobs build`
- Shared API changes:
  - `pnpm --filter @rbac/api-common lint`
  - `pnpm --filter @rbac/api-common build`
- Web changes:
  - `pnpm --filter @rbac/web-frontend lint`
  - `pnpm --filter @rbac/web-frontend build`
- App changes:
  - `pnpm --filter @rbac/app-frontend type-check`

Run the relevant checks for every touched package before considering the task complete.
