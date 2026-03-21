# Implementation History

Last updated: 2026-03-21

This document summarizes the major implementation changes completed across the recent long-running development cycle. It is intended to help future sessions resume work without reconstructing the history from commit diffs.

## 1. Monorepo foundation and RBAC baseline

- Consolidated the repository into a pnpm monorepo with:
  - `apps/backend`
  - `apps/backend-jobs`
  - `apps/web-frontend`
  - `apps/app-frontend`
  - `packages/api-common`
- Established the backend as a real database-backed RBAC service rather than a mock demo.
- Kept the app client on top of the official unibest structure and only customized request/auth integration.
- Centralized cross-platform request and type reuse in `packages/api-common`.

## 2. Upload system overhaul

- Fixed the invalid avatar upload flow by moving the web client to direct browser uploads against S3-compatible object storage.
- Expanded the file model and upload flow to support:
  - pre-signed upload creation
  - upload result callback
  - single-part direct uploads
  - multipart/chunked upload sessions for large files
- Standardized the backend around S3-compatible libraries so MinIO, OSS, COS, and other S3-adapter providers can be swapped in through compatible configuration.
- Kept the browser upload mechanism POST-based for the direct-upload flow.

## 3. Dedicated backend scheduled jobs package

- Added `apps/backend-jobs` as a separate package dedicated to scheduled tasks.
- Implemented an hourly upload reconciliation job that checks unfinished file uploads against S3.
- The reconciliation strategy is intentionally conservative:
  - single-part uploads are checked remotely and marked `SUCCESS` or `FAILED`
  - multipart uploads are skipped when still incomplete, because partial chunks may already exist
- This isolates background tasks from the request-serving backend process.

## 4. Menu tree and permission model redesign

- Added a menu table and menu-tree service on the backend.
- Introduced a three-level information model:
  - directory
  - page
  - action
- Defined structure rules:
  - directories may contain directories and pages
  - pages may contain actions
  - action nodes do not own child menus
- Enabled permission assignment on page nodes and action nodes.
- Added backend CRUD and query endpoints for:
  - full menu tree management
  - current-user accessible menu tree
  - menu-permission option loading
- Reworked login bootstrapping so the web frontend loads the current user's menu tree from the backend and renders navigation from that tree.
- Reinitialized seed data so menus, icons, and labels align with the new hierarchy and produce cleaner subtitles.

## 5. Page metadata refactor with `definePage`

- Replaced the old split metadata pattern with a page-local macro approach.
- Added `definePage(...)` and a Vite virtual page registry so page metadata can live directly inside the page component.
- Reduced the responsibility of page-local metadata:
  - keep-alive and cache behavior remain page-owned
  - title/caption/description/code remain page-owned
  - route path, order, and most navigation concerns moved out of page JSON and into the backend menu tree
- This makes page development more direct while keeping navigation and permission ownership server-driven.

## 6. Generic right-click context menu system

- Added a reusable `ContextMenuHost` component in the common component layer.
- Designed it as a configuration-driven wrapper so right-click menus can be attached to arbitrary interactive regions.
- Integrated it into list-style pages to support ergonomic right-click row actions such as deleting a single record.
- Extended the same interaction model to global workbench components:
  - right-click cached tabs for close actions
  - middle-click cached tabs to close
- This established a shared interaction primitive rather than duplicating ad-hoc context menus per page.

## 7. Type cleanup and TypeScript configuration corrections

- Audited frontend typing and removed `any` usage in the affected workbench/context-menu related code.
- Fixed TypeScript configuration warnings across the repo, including:
  - deprecated `baseUrl` warnings
  - `rootDir` / common source directory warnings
- Kept the project aligned with stricter typing and safer TS upgrades.

## 8. Menu management UX improvements

- Reworked the menu management page into a more ergonomic CRUD surface.
- Moved create/edit/delete flows to modal-based interactions instead of forcing inline tree editing for every operation.
- Added an UnoCSS icon picker so menu nodes can store icon identifiers directly.
- Updated sidebar rendering to consume menu icons from backend menu data.

## 9. Workbench, shell, and layout evolution

- Refined the global admin shell around a more productized workbench model.
- Added or completed:
  - sidebar light/dark appearance switching
  - page transition mode selection
  - cached-tab display mode selection
  - responsive sidebar collapse/expand
  - automatic compact behavior on smaller screens
  - hidden cached tabs in top-navigation mode
  - browser-style cached tab rendering
  - cached tab scrolling and navigation controls
  - header user dropdown with animated interactions
  - header icon-button cleanup
  - page description moved to the header instead of duplicating it in the page body
  - cached tabs integrated into the header area rather than floating as a separate strip
- Fixed several regressions and polish issues during this evolution:
  - collapsed sidebar icon visibility
  - sidebar header height jumpiness
  - submenu subtitle positioning
  - tab icons not rendering in the header
  - page body being blocked by sticky header/tab overlap
  - browser-tab styling producing the wrong geometry and overflow
  - missing horizontal scrolling for cached tabs
  - header controls wrapping into too many rows on narrow screens
- Final layout tuning reduced excessive whitespace in:
  - sidebar
  - header
  - tabs
  - page scaffold
  - table panels
  - footer

## 10. Development tooling and diagnostics

- Added `vite-plugin-vue-devtools` to the web frontend in serve mode, making it easier to inspect component trees and jump to source code while developing.

## 11. Current result

At the end of this cycle, the project is no longer just a CRUD starter. It now behaves more like an extensible admin framework with:

- real RBAC backend behavior
- direct-to-S3 upload infrastructure
- isolated background jobs
- server-driven menu/navigation ownership
- page-local metadata via `definePage`
- reusable context-menu infrastructure
- persistent workbench preferences
- a denser and more coherent admin-shell UI
