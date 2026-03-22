Recorded on 2026-03-22. Consolidated development rules and product expectations for this repo.

1. Global product standard
- User-facing copy must be concise, direct, and task-oriented. Do not place framework ideas, design philosophy text, prompt leftovers, implementation notes, environment descriptions, or mock/dev state on screen.
- Visual design must be simple, elegant, and logic-first. Remove decorative noise before adding new UI.
- Operations must follow user habits. Do not expose system internals that users do not need to make decisions.
- When a page pattern is wrong, fix the whole related flow instead of patching one control.

2. Web frontend rules
- Any list-style page must use pagination end to end. If a list is missing pagination, add backend query pagination and frontend paging controls together.
- Settings should be persisted via backend user configuration, not only local frontend state. User logout/login must not reset personal settings.
- Keep admin UI dense and professional. Adjust shared layout/tokens first, not page-local spacing hacks.
- Backend menu tree remains the single source of truth for navigation hierarchy, order, icons, and permission binding.
- Page SFCs should stay thin. For CRUD-style pages, split search toolbar, list/table, editor dialog, and detail panel into page-local components.

3. Uni mobile app rules
- Treat app-frontend as a mobile/mini-program product, not a shrunk web admin.
- Follow native mobile simplicity: compact spacing, restrained borders, minimal chrome, efficient vertical space usage.
- Do not stack large rounded-rectangle containers unless there is a strong functional reason. Avoid heavy cardification.
- Prefer Wot UI as the base design system and keep theme/tokens centralized instead of scattered handwritten styles.
- Keep shared mobile structure through root theme provider and shared page shell/section components.
- Use native tabbar for primary navigation instead of custom simulated tabbars when possible.

4. Auth page rules
- Login/register pages must not show mock state, current auth mode labels, username-password mode labels, or other development/debug information.
- Do not use crude login/register tab switching when contextual links already cover the flow. Prefer one clear primary form with a secondary entry to the alternate action.
- The auth panel should feel like a simple, polished mobile login component. The previous left-right overall layout direction is acceptable, but the form area must be refined and unobtrusive.
- Login pages in the uni app should not show an unnecessary back button.
- Copy on auth pages must stay minimal: title, brief helper text, field labels, submit action, and alternate action entry only.

5. Loading and empty-state rules
- index.html loading screen should show only a clean loading animation. Remove verbose loading text, slogans, or concept statements.
- Loading, empty, and status feedback should be short and readable. Never turn them into manifesto copy.

6. UI writing rules
- No large blocks of conceptual text such as 'design理念', implementation explanations, or prompt-derived sentences.
- Prefer short nouns/verbs users can scan immediately.
- If a sentence does not help the user complete a task, remove it.

7. Technical integration rules
- app-frontend H5 requests must be validated against real request traffic, not only prefetch behavior. A successful prefetch does not prove the real auth request path works.
- For local H5 auth, keep backend CORS aligned with the actual frontend origin including localhost:9000.
- Shared request and type boundaries should continue through packages/api-common.
- Backend route handlers stay thin; business logic belongs in services. Scheduled/background work belongs in apps/backend-jobs.
- Keep RBAC real and DB-backed.

8. Type and code quality rules
- TypeScript-first. Do not introduce any.
- Prefer small, composable edits. Reuse shared scaffolds/components instead of cloning UI structure.
- Do not regress page componentization that was already established in web-frontend.

9. Working-tree and git rules
- The repo may be dirty. Never revert or absorb unrelated user changes.
- Commit only scoped changes relevant to the task. Do not include unrelated backend migration or generated file churn.
- Do not create empty commits just to satisfy a 'submit' request when the relevant work is already committed.

10. Verification rules
- Before closing frontend work, run the relevant package lint/build/test commands.
- Current default checks that have already proven useful in this repo: pnpm --filter @rbac/app-frontend lint, pnpm --filter @rbac/app-frontend build, pnpm --filter @rbac/web-frontend lint, pnpm --filter @rbac/web-frontend build, pnpm --filter @rbac/backend test, pnpm --filter @rbac/api-common build.

11. Collaboration expectation for future tasks
- When the user says to inspect everything, actually review all related pages and flows, not just the first obvious page.
- If similar bad patterns appear in multiple places, perform a full cleanup pass and unify them.
- Default to concise Chinese product copy unless the existing area clearly uses another language.
- Future UI work in this repo should be judged against: concise copy, simple elegant visuals, native-feeling interaction, no leaked implementation detail, and consistent shared patterns.

12. Documentation discipline
- Any meaningful code change must be reflected in apps/docs in the same task: feature additions, refactors, behavior changes, new pages, new menus, new routes, new shared APIs, new client types, new exports, and test changes.
- Docs are for developers. Keep them concise, implementation-first, and extension-oriented. Do not add theory, slogans, rhetorical questions, or long conceptual copy.
- When implementation changes affect testing, update the testing documentation as well as any related quick-start or module guide pages.
- Treat stale docs as a bug, not a follow-up nicety.

13. Testing discipline
- Every non-trivial change should either add tests or tighten existing tests. Do not treat tests as optional cleanup.
- Keep tests split by responsibility: framework tests for shared abstractions, integration tests for real API and business flows.
- Important behavior that should not regress in this repo includes auth, RBAC, OAuth/OIDC, client validation, exports, attachments, delete guards, pagination, and user preference persistence.
- Before closing work, run the relevant verification commands for the affected packages and ensure tests remain green.

14. Requirement synthesis rule
- Do not treat repeated user feedback as isolated one-off instructions. Consolidate it into stable project rules and apply it proactively to future work.
- When new requirements arrive, think through adjacent modules, shared abstractions, tests, and docs that should move together, instead of patching a single file in isolation.
- Prefer a short internal summary of the lasting rule before implementation so future changes stay consistent.