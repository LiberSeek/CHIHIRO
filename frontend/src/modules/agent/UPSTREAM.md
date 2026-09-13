# AstrBot ChatUI source record

`AgentModule.vue`, `AgentSidebar.vue`, `AgentThread.vue`, and `useAgentWorkspace.ts` are a Chihiro rewrite prototype. They are not a source extraction of AstrBot ChatUI and must not be used as evidence of feature parity. Their HTTP and stream contract differs from the pinned implementation; see `docs/chatui-source-audit.md`.

The only source-extracted code currently in this directory is `astrbot-protocol.ts`. It preserves `buildChatRequestFlags`, `partToPayload`, and `readSseStream` from `dashboard/src/composables/useMessages.ts`; it is not yet wired into the prototype.

- Repository: `https://github.com/AstrBotDevs/AstrBot`
- Chihiro submodule commit: `8b958b08e7fef3948d750d2891aabd80c0828f76`
- Extracted source path: `dashboard/src/composables/useMessages.ts`
- Extraction date: 2026-09-14
- License: GNU Affero General Public License v3.0, inherited from AstrBot. The repository license text remains at `vendor/astrbot/LICENSE`.

The real migration entry is `dashboard/src/components/user/UserChat.vue` and requires the dependency closure in the audit. It must preserve source behavior while adapting Vuetify, router, Pinia, i18n, confirmation, toast, and hosted layout boundaries to the single frontend. It must not import AstrBot bootstrap code or create another Vue application.

## Host integration

Do not switch the product route to `AgentModule` until the full source migration has contract tests against pinned AstrBot and feature parity is verified.
