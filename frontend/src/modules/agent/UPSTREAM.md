# AstrBot ChatUI source record

The `/next/agent/:conversationId?` preview now mounts `native/src/components/user/UserChat.vue` inside the root Vue application. `AgentModule.vue` provides its ordinary two-pane container, responsive list/thread navigation, Vuetify theme and toast surface. Pinia and Router are shared with the product shell; no iframe, extra createApp or runtime IIFE is used.

The native module preserves the recursive dependency closure of pinned AstrBot `8b958b08e7fef3948d750d2891aabd80c0828f76`. See `native/UPSTREAM.md`, `native/source-manifest.json`, and `native/LICENSE` for source and AGPL attribution. Hosted HTTP uses private Axios clients, the Gateway `/astrbot/api/v1` namespace, and `/agent` session routes. It does not install global fetch patches or redirect the shell to AstrBot login.

`AgentSidebar.vue`, `AgentThread.vue`, and `useAgentWorkspace.ts` are retired rewrite prototypes, retained temporarily for comparison. They are no longer mounted by the preview. `astrbot-protocol.ts` is an earlier helper extraction, also retained for reference.

## Acceptance boundary

The built native preview has been checked with an isolated mock server for session history rendering, visible sidebar/composer, and desktop/mobile layout. Frontend typecheck, build, and 20 existing tests pass. These tests do not establish full protocol parity: real streaming, stop/resume, uploads, project mutations and provider configuration still require acceptance. The default `/` route remains the legacy workbench until IM and Agent parity is verified.
