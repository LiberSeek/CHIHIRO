# Stage D Agent native audit

Date: 2026-09-15

## Current boundary

The active Agent preview is loaded by `frontend/src/modules/agent/loader.ts` and
mounts `native/src/components/user/UserChat.vue` through the existing root Vue
application. It does not load a runtime IIFE, create a second Vue app, install a
memory router, patch global `fetch`, or expose `window.ChihiroChatUI`.

`AgentSidebar.vue`, `AgentThread.vue`, and `useAgentWorkspace.ts` are retired
rewrite prototypes. They still contain a small standalone fetch client and a
`window.confirm` call, but no active product path imports them. Removing those
files and their exports is safe only after the retained comparison value is no
longer needed.

## Remaining dependencies

| Area | Dependency | Risk |
| --- | --- | --- |
| `native/src/components/user/UserChat.vue` | Uses the shell `useWorkspace`, `useRoute`, and `useRouter` directly; dispatches `chihiro-open-external-settings` on `window`; reads browser storage and viewport APIs. | Route and settings behavior cannot yet be embedded under a different host contract. |
| `native/src/composables/useSessions.ts` | Chooses `/agent` from module-level hosted state and pushes routes directly. | Session state and navigation are coupled, with navigation split across two files. |
| `native/src/components/shared/KnowledgeBaseSelector.vue` | Pushes the full Dashboard `/knowledge-base` route. | The extracted component can navigate outside the product Agent route surface. |
| `native/src/api/http.ts` | Keeps auth mode in module state and reads `localStorage` and `window.location` for standalone Dashboard compatibility. | Hosted mode is safe, but transport policy remains shared with the retained Dashboard mode. |
| `AgentModule.vue` | Installs AstrBot customizer/toast stores and a Vuetify application surface. | The chat component still expects Dashboard-derived theme and notification services. |
| `loader.ts` | Lazily installs Vuetify, i18n, and HTTP services on the root app before resolving the component. | The component cannot yet be mounted with a small, explicit set of injected services. |

## First extraction seam

Hosted route configuration now enters through `installAgentNative` as an
explicit Gateway base. `resolveAgentApiBase` is a pure module-owned resolver
shared by the generated OpenAPI client, legacy Axios calls, streaming URLs, and
file URLs. A test sets the removed Dashboard global marker to the opposite value
and verifies that the configured Gateway base still wins.

## Recommended split order

1. Add an injected navigation adapter for session selection, provider view, and
   advanced settings; move all `router.push` and shell event dispatches behind it.
2. Split `useSessions` into session data operations and navigation policy, then
   make `UserChat` consume the data composable through injection.
3. Add injected storage, confirm, toast, and viewport adapters where browser
   globals currently appear in user actions or initialization.
4. Replace the Dashboard customizer and `v-app` wrapper with product theme and
   overlay services while retaining only the Vuetify components still used by
   the dependency closure.
5. Remove the retired `AgentSidebar`, `AgentThread`, `useAgentWorkspace`, and
   earlier protocol helper after the native component owns the documented seams.

The highest regression risk is session route synchronization: project
selection, new sessions, deletion, browser navigation, and mobile sidebar close
behavior currently mutate shared state in a specific order. Characterization
tests should cover that order before extracting navigation.
