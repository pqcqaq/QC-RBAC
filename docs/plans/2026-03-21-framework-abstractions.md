# 2026-03-21 Framework Abstractions

> Historical snapshot: 这是 2026-03-21 的阶段性设计记录。当前实际实现与约束请优先参考 `README.md`、`docs/project-memory.md` 与 `docs/development-guidelines.md`。

## Goal

Reduce repetitive CRUD and RBAC mutation code across the monorepo so future pages and routes can be added with less duplicated wiring.

## Decisions

1. Shared API factory now exposes a generic CRUD endpoint builder.
   This keeps resource clients consistent across web and app frontends.

2. Backend RBAC mutations now go through a unified publisher.
   Audit logging, socket broadcasting, and permission-cache invalidation stay aligned and harder to forget.

3. Backend record mappers are centralized.
   User, role, and permission summaries/records now share the same conversion rules across routes and services.

4. Web CRUD pages now share composables for editor, detail, and delete flows.
   `users`, `roles`, and `permissions` can reuse the same state transitions, feedback handling, and request orchestration.

## Tradeoffs

- The new abstractions intentionally stop short of full code generation.
  Each page and route still owns its own domain validation and view composition.

- Some files remain page-specific because menus and upload flows have different interaction models.
  Those should only be generalized after a second real consumer appears.
