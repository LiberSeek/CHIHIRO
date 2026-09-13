# AstrBot UserChat source audit

Baseline: AstrBot submodule `8b958b08e7fef3948d750d2891aabd80c0828f76`, audited 2026-09-14. Source paths below are relative to `vendor/astrbot/dashboard/src/`.

## Finding

`frontend/src/modules/agent/` is an independent rewrite, not an extraction of pinned `UserChat`. It reproduces a small layout subset but guesses a reduced HTTP/SSE contract, so it cannot replace legacy ChatUI or support a parity claim.

The migration entry is `components/user/UserChat.vue`, mounted by `views/user/UserChatPage.vue` and by legacy host `chihiro/ChihiroChatUI.vue`. Copy the former dependency closure; do not copy the latter bootstrap wrapper.

## Required dependency closure

| Area | Source files | Behavior to preserve |
|---|---|---|
| Sessions | `composables/useSessions.ts`, `utils/chatConfigBinding.ts` | list/create/select/delete/batch delete/rename, route and config binding |
| Protocol/state | `composables/useMessages.ts`, `api/v1.ts`, `api/http.ts` | structured history, concurrent runs, SSE/WebSocket, resume, stop, edit/regenerate, media |
| Projects | `composables/useProjects.ts` | CRUD, membership, project sessions, workspace type/path |
| Input/media | `components/chat/ChatInput.vue`, `CommandSuggestion.vue`, `ConfigSelector.vue`, `ProviderModelMenu.vue`, `composables/useMediaHandling.ts`, `useDragUpload.ts`, `useRecording.ts`, `useVADRecording.ts` | multipart input, reply, commands, model/config, paste/drop/upload/record |
| Messages | `components/chat/ChatMessageList.vue`, `MessageList.vue`, `RegenerateMenu.vue` | rich parts, edit/copy/reply/regenerate/thread actions |
| Rendering | `components/chat/message_list_comps/*.vue`, `chatMarkdownComponents.ts`, `markdownRenderConfig.ts` | Markdown/code/KaTeX/Mermaid, reasoning, tools, refs, generated UI |
| Panels | `components/chat/{ThreadPanel,ThreadedMarkdownMessagePart,ReasoningSidebar,WorkspaceFilesPanel}.vue` | threads, reasoning/refs, project files |
| Projects/providers | `components/chat/{ProjectList,ProjectDialog,ProjectView,ProviderConfigDialog}.vue`, `components/provider/ProviderChatCompletionPanel.vue` | project and provider workspaces |
| Host services | `stores/{customizer,chatHeader}.ts`, `i18n/composables.ts`, `utils/{confirmDialog,toast,imeInput}.ts` | responsive layout, context, locale, confirmation/errors, IME |

Further runtime dependencies absent from the new frontend include Vuetify, `@lucide/vue`, axios/OpenAPI support, `markstream-vue`, Markdown-it, DOMPurify, KaTeX, Mermaid, Shiki/highlight.js, and Monaco. Record versions/licenses from `dashboard/package.json` before extraction.

## Exact API mismatches

| Operation | Pinned AstrBot | Prototype |
|---|---|---|
| Sessions | `GET /chat/sessions`; `POST /chat/sessions/new`; item GET/PATCH/DELETE | paths mostly match; result shapes are guessed, platform/config binding omitted |
| History | item GET returns structured records, project and `active_runs` | flattened to `{role,content}`; active runs ignored |
| Stop | `POST /chat/sessions/{id}/stop` | aborts fetch only, leaving server generation running |
| Send | `POST /chat` with `message: MessagePart[]`, `flags`, `selected_provider`, `selected_model`, history/checkpoint controls | sends a string, top-level `enable_streaming`, no provider/checkpoint controls |
| Resume/WebSocket | `GET /chat/runs/{run_id}/stream`; `/unified-chat/ws` | absent |
| Projects | full CRUD, session membership, workspace files | list only |
| Files/messages/threads | upload/content; edit/regenerate; thread CRUD/send | absent |
| Providers/config | provider APIs and `/chat/configs` | absent; `models` is never populated |

AstrBot returns `{status,message,data}` envelopes. The prototype `unwrap()` silently accepts unrelated nested shapes instead of checking source success semantics.

## Streaming mismatch

AstrBot SSE is not an OpenAI delta stream. `useMessages.ts` parses blank-line-delimited events, including multiline `data:`, then dispatches `type`/`t`, `ct`, `chain_type`, and `data`. Events include `run_started`, `run_snapshot`, `follow_up_captured`, `user_message_saved`, `message_saved`, `agent_stats`, `plain`, media types, `complete`, `break`, `error`, and `end`. `plain` may carry reasoning, tool calls, or tool results via `chain_type`.

The prototype splits individual lines and reads only `delta`, `text`, `message`, or `content`. Real `{type:'plain',data:'...'}` events render empty. It also loses run IDs, checkpoints, refs, tools, final reconciliation, follow-up ordering, media, and reconnection. `[DONE]` is not the pinned protocol.

`frontend/src/modules/agent/astrbot-protocol.ts` extracts the source flag builder, part serializer, and SSE framing parser with tests. It is a building block only; full event reduction remains part of `useMessages.ts` migration.

## Behavioral omissions

Missing capabilities include provider workspace/model selection, chat configs, project CRUD/membership/files, multipart messages, upload and recording, replies and commands, rich rendering, reasoning/tools/refs/generated UI, edit/regenerate/checkpoint continuation, threads, resumable and concurrent runs, WebSocket, server stop, batch delete, per-session caches, responsive navigation, confirmation/toast/i18n, and Chihiro session notification.

## Migration order

1. Record dependency provenance and extract generated chat/file/provider API types behind the unified Gateway client.
2. Extract complete session, project, media, and message protocol/state modules, adapting router/store access through host interfaces.
3. Extract composer, renderers, projects, panels, and provider UI in dependency order.
4. Adapt `UserChat.vue` as an ordinary root route; do not copy `ChihiroChatUI.vue`, `mount.ts`, `main.ts`, router/Pinia/Vuetify app creation, or Teleport shell glue.
5. Test real envelopes/SSE fixtures, resume snapshots, tools/reasoning/media, server stop, projects, and a pinned live runtime before changing the default UI.

Keep legacy ChatUI available until these steps reach verified parity.
