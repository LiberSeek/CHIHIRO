# Stage C IM parity audit

Audit target: native IM migration under `frontend/src/modules/im/native` against the in-tree Chihiro Stapxs reference under `vendor/stapxs/src/renderer/src`. Scope is the 0.1.0 acceptance interactions requested for Stage C.

| Area | Result | Evidence |
| --- | --- | --- |
| Image preview | Parity retained. Native viewer is hosted in `#chihiro-im-overlays`, shows sender avatar/name/time in the lower bar, proxies display URLs, and closes during account reset. | `src/components/user/UserViewerCom.vue`, `reset.test.ts` |
| Forward window | Fixed. Recent targets are now prioritized in a copied list, so opening the window cannot reorder `contactStore.userList`; the target row key distinguishes users and groups. | `src/pages/user/UserChat.vue`, `chat-interaction.ts` |
| Emoji popup | Parity retained. The native `UserFacePan` preserves the Stapxs tabs and sends insertions through the hosted composer. | `src/components/user/UserFacePan.vue`, `src/pages/user/UserChat.vue` |
| Empty composer return | Fixed. The send button now uses `mainSubmit`, matching form and Enter behavior, so an empty composer does not call `sendMsg`. | `src/pages/user/UserChat.vue`, `chat-interaction.ts` |
| Contact single/double click | Parity retained. Single click schedules profile inspection; double click cancels it and opens the chat. Keyboard Enter and Space map to the corresponding actions. | `src/pages/user/UserFriends.vue`, `contact-interaction.test.ts` |
| Transparent background | Host surfaces now force solid card backgrounds for modal bodies, forward cards, chat info, face and jin panels; theme token scoping is covered. Final compositing still benefits from a real browser check. | `WorkspaceModule.vue`, `workspace-layout-contract.test.ts`, `theme-isolation.test.ts` |
| Toast surface | Global toast is teleported to `body` and fixed at top center; native modal state is cleared through `clearNativePopups`. | `WorkspaceModule.vue`, `workspace-layout-contract.test.ts`, `popups.test.ts` |
| Top height | Native chat header and composer sizing are custom Chihiro layouts rather than byte-identical Stapxs markup. Their visual height needs a browser viewport check at desktop and mobile widths. | `src/pages/user/UserChat.vue`, `src/components/user/UserComposer.vue` |

## Remaining acceptance order

1. Run `npm run qa:native-im --workspace frontend` against the built app when a browser fixture is available and inspect desktop/mobile screenshots.
2. In a real account, manually verify image preview forward/edit, face popup, forward window and empty composer return; Node tests cover the state contracts but not real NapCat media URLs, CORS, or final pixels.
3. Keep the acceptance item open until that visual/manual pass is done.

## Validation status

Current automated validation passes with the project runtime: `npm run test --workspace frontend`, `npm run typecheck --workspace frontend -- --pretty false`, `npm run build --workspace frontend`, and `node frontend/src/modules/im/native/verify-source.mjs`. Docker image validation is still pending because the local Docker daemon is unavailable in the current environment.
