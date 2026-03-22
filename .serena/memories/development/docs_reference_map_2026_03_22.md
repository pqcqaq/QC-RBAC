Recorded on 2026-03-22. `apps/docs` is now a primary implementation reference for QC-RBAC. When resuming work or exploring an area that may already be documented, check the relevant docs page before reading large code areas.

Docs entry rules:
- Start at `apps/docs/index.md` for the current reading order and module map.
- Treat docs as developer documentation, not marketing copy. They should stay concise, implementation-first, and extension-oriented.
- If code changes make docs stale, update docs in the same task.

Recommended reading order:
1. `apps/docs/guide/quick-start.md`
   - Environment bootstrap, seed expectations, default clients, local run commands.
2. `apps/docs/guide/development.md`
   - High-level implementation map and cross-module development guidance.
3. `apps/docs/guide/backend.md`
   - Auth, RBAC, OAuth/OIDC, uploads/attachments, exports, Prisma governance, delete checker, timers.
4. `apps/docs/guide/web-frontend.md`
   - Web login, console layout, dynamic menus, list pages, exports, page organization.
5. `apps/docs/guide/uni-frontend.md`
   - Uni/mobile auth, custom header/tabbar, safe-area handling, custom components, mobile page structure.
6. `apps/docs/guide/shared.md`
   - `packages/api-common` contracts: auth-client enums/config, request clients, adaptors, API factory, download abstraction.
7. `apps/docs/guide/testing.md`
   - Current framework/integration test layout and named test coverage.
8. `apps/docs/guide/extension.md`
   - How to extend client types, shared APIs, modules, and exports.
9. `apps/docs/architecture/tech-stack.md`
   - Current stack choices and where substitutions are acceptable.

Fast lookup by task:
- Need runtime/bootstrap info: `quick-start.md`
- Need backend implementation detail: `backend.md`
- Need web page/module behavior: `web-frontend.md`
- Need uni/mobile behavior: `uni-frontend.md`
- Need shared API or type boundary: `shared.md`
- Need test entry points or expected coverage: `testing.md`
- Need extension path: `extension.md`

Important rule:
- Docs help recover context faster, but they do not replace code. Use docs first to narrow the search area, then inspect the actual implementation files.