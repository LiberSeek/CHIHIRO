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
| `native/src/components/user/UserChat.vue` | Uses the shell `useWorkspace` and `useRoute` for hosted route synchronization; reads browser storage and viewport APIs. | Route reads are still component-local, but route writes now go through the injected navigation adapter. |
| `native/src/composables/useSessions.ts` | Owns session data and asks the injected navigation adapter to open sessions or login. | Session state and navigation are still returned from one composable, but hosted path selection no longer lives here. |
| `native/src/components/shared/KnowledgeBaseSelector.vue` | Asks the injected navigation adapter to open the knowledge-base surface. | Hosted mode opens the AstrBot Dashboard knowledge-base page as an advanced external surface instead of navigating the product router away. |
| `native/src/api/http.ts` | Keeps auth mode in module state and reads `localStorage` and `window.location` for standalone Dashboard compatibility. | Hosted mode is safe, but transport policy remains shared with the retained Dashboard mode. |
| `AgentModule.vue` | Installs AstrBot customizer/toast stores and a Vuetify application surface. | The chat component still expects Dashboard-derived theme and notification services. |
| `loader.ts` | Lazily installs Vuetify, i18n, and HTTP services on the root app before resolving the component. | The component cannot yet be mounted with a small, explicit set of injected services. |

## Completed extraction seams

1. Hosted route configuration now enters through `installAgentNative` as an
   explicit Gateway base. `resolveAgentApiBase` is a pure module-owned resolver
   shared by the generated OpenAPI client, legacy Axios calls, streaming URLs,
   and file URLs. A test sets the removed Dashboard global marker to the
   opposite value and verifies that the configured Gateway base still wins.
2. Hosted navigation now enters through `agentNavigationKey`. Session open, new
   chat, provider workspace, back, knowledge-base, settings, and login actions
   are expressed as host intents. The千寻 host maps Agent sessions to
   `/im?tab=workbench&agent=<sessionId>` so refresh stays inside the unified IM
   workbench. The legacy `/agent/:conversationId?` route remains as a
   compatibility ingress and immediately normalizes to the workspace route.

## Recommended split order

1. Split `useSessions` into session data operations and navigation policy, then
   make `UserChat` consume the data composable through injection.
2. Add injected storage, confirm, toast, and viewport adapters where browser
   globals currently appear in user actions or initialization.
3. Replace the Dashboard customizer and `v-app` wrapper with product theme and
   overlay services while retaining only the Vuetify components still used by
   the dependency closure.
4. Remove the retired `AgentSidebar`, `AgentThread`, `useAgentWorkspace`, and
   earlier protocol helper after the native component owns the documented seams.

The highest regression risk is session route synchronization: project
selection, new sessions, deletion, browser navigation, and mobile sidebar close
behavior currently mutate shared state in a specific order. Characterization
tests should cover that order before extracting navigation.
