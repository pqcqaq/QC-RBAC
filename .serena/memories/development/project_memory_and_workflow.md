Updated on 2026-03-22. Resume project context from `apps/docs/index.md` first, then follow the docs reading order there. In practice: start with `apps/docs/guide/quick-start.md` for environment/bootstrap, `apps/docs/guide/development.md` for the implementation map, then use the module guide pages (`backend.md`, `web-frontend.md`, `uni-frontend.md`, `shared.md`, `testing.md`, `extension.md`) as the primary implementation reference.

Current repo shape: pnpm monorepo with `apps/backend`, `apps/web-frontend`, `apps/app-frontend`, `apps/oauth-test-provider`, `apps/oauth-test-application`, `apps/docs`, and `packages/api-common`.

Current architecture anchors:
- Backend-driven auth, RBAC, clients, OAuth/OIDC, files/attachments, exports, and timer registration live in `apps/backend`.
- Backend menu tree remains the source of truth for navigation, hierarchy, icons, and permission binding.
- Web workbench state, dynamic menus, console pages, and exports live in `apps/web-frontend`.
- Uni/mobile pages use custom header, custom tabbar, custom components, and unified safe-area/layout handling in `apps/app-frontend`.
- Shared request clients, auth-client types, API factory, permissions, and download abstractions live in `packages/api-common`.
- `apps/docs` is the maintained developer-facing map of these implementations and should be consulted before exploratory code reading when the topic is already documented.

Workflow rules:
- Check relevant memories first, then check the corresponding `apps/docs` page, then inspect code.
- Treat docs and tests as part of the implementation. Any meaningful change must update both when they become stale.
- Default verification baseline for meaningful work: backend lint/tests, relevant focused backend integration tests, app-frontend type-check, and any additional package checks touched by the change.
- Existing rule memories that should be considered together for future work: `development/future_development_rules_2026_03_22`, `development/docs_and_test_sync_rules_2026_03_22`, and the current `style_and_conventions` memory.