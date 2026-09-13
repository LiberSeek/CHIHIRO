# AstrBot ChatUI source record

This module is derived from the Chihiro `User*` AstrBot Dashboard UI rather than from an application bundle.

- Repository: `https://github.com/AstrBotDevs/AstrBot`
- Chihiro submodule commit: `8b958b08e7fef3948d750d2891aabd80c0828f76`
- Source paths: `dashboard/src/components/user/UserChat.vue`, `UserChatHeader.vue`, `dashboard/src/components/chat/*`, `dashboard/src/composables/{useSessions,useMessages,useProjects,useMediaHandling}.ts`
- Extraction date: 2026-09-14
- License: GNU Affero General Public License v3.0, inherited from AstrBot. The repository license text remains at `vendor/astrbot/LICENSE`.

The extraction keeps the UserChat information architecture and core behavior: project/session navigation, session CRUD, model context, message history, stream cancellation and incremental SSE rendering. It replaces Vuetify widgets and global Dashboard stores with module-local Vue components and an explicit `AgentClient` boundary. It does not import AstrBot bootstrap code, create an app/router/Pinia instance, inject scripts, mutate `window`, or Teleport panes into a separate shell.

## Host integration

Mount `AgentModule` as an ordinary route component inside the root application. Its default client calls the Gateway at `/astrbot/api/v1`; the Gateway must proxy this path to AstrBot and preserve streaming response bodies. If backend contracts change, construct an `AgentWorkspace` with an `AgentClient` adapter and provide it to `AgentSidebar` and `AgentThread` from the host-owned workspace component.

The current extraction expects these AstrBot routes: `GET/POST /chat/sessions`, `GET/PATCH/DELETE /chat/sessions/:id`, `GET /chat/projects`, and `POST /chat` with SSE or JSON output. Authentication remains Gateway-owned. `X-Chihiro-Account` is sent when an account context exists.

Provider/model discovery, file upload/preview, project CRUD/workspace files, rich Markdown/LaTeX rendering, message edit/regenerate, reasoning/reference panels, and threaded sub-conversations still need dependency-closure extraction before legacy ChatUI reaches full parity.
