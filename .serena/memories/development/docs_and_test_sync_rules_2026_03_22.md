Recorded on 2026-03-22. User explicitly requires the following long-term workflow rules for QC-RBAC:

1. Testing is mandatory
- Any meaningful change should improve or add tests in the same task.
- Keep tests well split by responsibility: framework-level abstractions belong in apps/backend/test/framework, real business/API flows belong in apps/backend/test/integration.
- Do not ship changes affecting auth, RBAC, OAuth/OIDC, clients, exports, attachments, delete guards, pagination, settings persistence, or other core flows without verification.

2. Documentation must stay synchronized
- Any meaningful implementation change must be reflected in apps/docs in the same task.
- Update not only the obvious module page, but also quick-start, development, shared abstractions, testing docs, or other related pages when they become stale.
- Treat stale docs as a bug.

3. Summarize recurring requirements into stable rules
- Do not handle repeated feedback as isolated one-off instructions.
- Extract the lasting rule behind the request and apply it proactively to related pages, modules, shared abstractions, tests, and docs.
- Prefer a short internal summary of the durable rule before implementation so future work remains consistent.

4. Documentation style
- Docs are for developers.
- Keep wording concise, implementation-first, and extension-oriented.
- Avoid marketing language, theory-heavy explanations, rhetorical questions, and prompt-derived copy.