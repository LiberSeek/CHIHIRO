# Stage C IM parity audit

Audit target: native IM migration under `frontend/src/modules/im/native` against the in-tree Chihiro Stapxs reference under `vendor/stapxs/src/renderer/src`. Scope is the 0.1.0 acceptance interactions requested for Stage C.

| Area | Result | Evidence |
| --- | --- | --- |
| Image preview | Parity retained; native viewer is hosted in `#chihiro-im-overlays`, proxies display URLs, and protects delayed viewer events with account scopes. | `src/components/user/UserViewerCom.vue` |
| Forward window | Fixed. Recent targets are now prioritized in a copied list, so opening the window cannot reorder `contactStore.userList`; the target row key distinguishes users and groups. | `src/pages/user/UserChat.vue`, `chat-interaction.ts` |
| Emoji popup | Parity retained. The native `UserFacePan` preserves the Stapxs tabs and sends insertions through the hosted composer. | `src/components/user/UserFacePan.vue`, `src/pages/user/UserChat.vue` |
| Empty composer return | Fixed. The send button now uses `mainSubmit`, matching form and Enter behavior, so an empty composer does not call `sendMsg`. | `src/pages/user/UserChat.vue`, `chat-interaction.ts` |
| Contact single/double click | Parity retained. Single click schedules profile inspection; double click cancels it and opens the chat. Keyboard Enter and Space map to the corresponding actions. | `src/pages/user/UserFriends.vue`, `contact-interaction.test.ts` |
| Transparent background | Code parity retained through extracted vibrancy styles and `user.css` theme scoping. Visual compositing needs a real macOS QQ-container check. | `src/assets/css/user.css`, `theme-isolation.test.ts` |
| Toast surface | Native modal state is cleared through `clearNativePopups`; visual placement and stacking need hosted browser QA. | `popups.ts`, `popups.test.ts` |
| Top height | Native chat header and composer sizing are custom Chihiro layouts rather than byte-identical Stapxs markup. Their visual height needs a browser viewport check at desktop and mobile widths. | `src/pages/user/UserChat.vue`, `src/components/user/UserComposer.vue` |

## Remaining acceptance order

1. Run `npm run qa:native-im --workspace frontend` after building the native IM and inspect its desktop/mobile screenshots.
2. In a real account, verify transparent/vibrancy rendering and toast position because neither is meaningful in node-based tests.
3. Manually test preview image forward, edit-and-send, and cancel across an account switch; the source has scope guards, but real NapCat media URLs and CORS are outside fixture coverage.

## Validation limitation

The native source verifier currently stops at a pre-existing manifest mismatch for `src/components/user/UserComposer.vue` (working hash `fb58d39d59ca359dc0bec55dcfd25d73f16d067b5ef779091ee38742f50b35ce`, manifest hash `c11c1d0caeaa7e73e0c18964853f886c9bf2ba0f1aeede00133117accb200a59`). This audit updates only the `UserChat.vue` manifest entry it changes. Vitest also cannot start with the bundled Node 20.12.2 because `rolldown` passes an array to `node:util.styleText`; use the project-supported Node runtime before treating automated validation as complete.
