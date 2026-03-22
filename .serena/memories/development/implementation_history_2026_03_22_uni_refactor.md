Implementation history recorded on 2026-03-22.

Scope completed:
- Rechecked web list pages for pagination and implemented end-to-end pagination where required.
- Refactored noisy web copy and loading states so framework philosophy text is no longer displayed to users.
- Reworked login UX multiple times to remove mock/dev exposure, reduce crude mode switching, and simplify login/register flows.
- Fixed settings reset after logout/login by persisting user settings through backend-backed user configuration.
- Rebuilt the uni app pages around a mobile-native direction and unified theme/style handling.

Key commits:
- ec444d5 refactor: rebuild uni mobile pages
- cf91d40 fix: allow uni h5 auth requests
- 327d82e refactor: unify uni ui with wot theme

Validated conclusions:
- The correct direction for app-frontend is Wot UI + centralized theme tokens + shared page shell components, not fragmented page-specific styling.
- Native mobile feel requires removing oversized cards, verbose hero copy, debug labels, and unnecessary navigation chrome.
- H5 login failure root cause was backend CORS not allowing the actual localhost:9000 origin even though prefetch looked normal.
- Login UX is better handled by clear single-purpose forms with alternate-action links than by large segmented auth-mode switches.
- Current uni root/theme structure is anchored by App.ku.vue, composables/useAppTheme.ts, style/index.scss, and shared page shell/section components.

Files and areas that became architecture anchors for the uni app:
- apps/app-frontend/src/App.ku.vue
- apps/app-frontend/src/composables/useAppTheme.ts
- apps/app-frontend/src/style/index.scss
- apps/app-frontend/src/components/app-page-shell/app-page-shell.vue
- apps/app-frontend/src/components/app-section/app-section.vue
- apps/app-frontend/src/pages/auth/login.vue
- apps/app-frontend/src/pages/auth/register.vue
- apps/app-frontend/src/pages/index/index.vue
- apps/app-frontend/src/pages/me/me.vue
- apps/app-frontend/src/pages/me/profile.vue
- apps/app-frontend/src/pages/settings/index.vue

User preference reaffirmed on 2026-03-22:
- Strongly reject verbose concept copy, mock/dev status on UI, awkward login switches, and bulky rounded container-heavy mobile pages.
- Prefer clean, restrained, native-like mini-program/mobile interfaces with brief copy and clear actions.
- When a visual pattern is off, refactor the whole affected flow instead of leaving mixed styles in place.