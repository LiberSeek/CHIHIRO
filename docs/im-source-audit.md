# Stapxs native IM source audit

Date: 2026-09-14. Scope: the native source dependency closure of `UserChat.vue` and `UserMessages.vue`, extracted without running QQ, opening a connection, or sending messages.

## Provenance and license

- Repository: `https://github.com/Stapxs/Stapxs-QQ-Lite-2.0.git`
- Pinned branch and commit: `next` at `7a895b964a67faf72f912370eb769adce16e37cc`
- In-tree package version: `3.5.0`
- License: AGPL-3.0-only; authoritative text remains at `vendor/stapxs/LICENSE`
- Product baseline containing the extraction: repository commit `a8930ddfa01d16fd4c2c288c1c4d7d4bcd346d41`; immutable product tag remains `0.0.1`

The post-transform file inventory and SHA-256 hashes are in `frontend/src/modules/im/native/source-manifest.json`. `verify-source.mjs` makes drift detectable. The extraction contains 115 source/data files after adding build-time glob and CSS assets; it does not copy the upstream application entry, root `App.vue`, dashboards unrelated to the two roots, or the vendor license file.

## Closure contents

The roots reach the actual Chihiro pages and implementation dependencies, including `UserComposer`, `UserMsgBody`, notices, emoji/face handling, file/message viewers, profile and merge panels, history utilities, sender/message/connector functions, Pinia state, and browser/desktop backend abstraction. The graph also reaches settings and info pages through runtime option/popover flows; these are retained because removing them would be a behavioral rewrite rather than a source extraction.

The initial graph included `main.ts`, which imports `App.vue`, creates Vue, Pinia and i18n instances, registers global plugins/components, imports global CSS, preloads pinyin, initializes AMap, and mounts `#app`. All extracted `@renderer/main` imports are rewritten to `@chihiro/im-native/host`. `host.ts` exposes only translation/locale and clipboard services. No extracted file imports `main.ts`, calls `createApp`, or mounts an application.

## Explicit unresolved boundaries

The dedicated native Vite configuration compiles the actual public `index.ts`. It does not register the module in the product route. Production integration still requires:

1. Register Font Awesome and any required directives/components once in the product app. Upstream did this in `main.ts`; extraction deliberately does not reproduce that bootstrap.
2. Decide which upstream global CSS to scope under the IM module. `main.ts` imported `view.css`, `chat.css`, `msg.css`, `options.css`, `sys_notice.css`, and `user.css`; copying them without a selector/collision audit would pollute the unified shell.
3. Replace desktop/mobile host APIs with product services where appropriate. The retained backend abstraction references Electron, Tauri and Capacitor and Rollup warns that their Node-side entry points are externalized in a browser build. The web path builds, but desktop/mobile paths have not been runtime tested.
4. Refactor account ownership before use with multiple accounts. `function/connect.ts` owns module-level login/connector/retry state, stores are singleton Pinia definitions, and utilities use global storage and DOM identifiers. An active-account prop cannot make asynchronous work account-safe. The required boundary is an account-scoped connector/session factory plus account-keyed stores, drafts, history, uploads, subscriptions, and disposal.
5. Replace additional global UI assumptions. Notifications/popovers use shared queues/DOM hosts, some components Teleport to `body`, and option code mutates locale/config and loads CSS dynamically.

## Packages required at root installation

The static graph imports these packages beyond the frontend's existing `vue` and `pinia`: `@capacitor/core`, `@capacitor/keyboard`, `@capacitor/local-notifications`, `@electron-toolkit/preload`, `@fortawesome/fontawesome-svg-core`, `@fortawesome/free-regular-svg-icons`, `@fortawesome/free-solid-svg-icons`, `@fortawesome/vue-fontawesome`, `@stapxs/umami-logger-typescript`, `@tauri-apps/api`, `@tauri-apps/plugin-clipboard-manager`, `@vuemap/vue-amap`, `animejs`, `browser-image-compression`, `detect-browser`, `echarts`, `js-file-downloader`, `jsonpath`, `markdown-it`, `pofile`, `semver`, `spacingjs`, `uuid`, `vconsole`, `vue-clipboard2`, `vue-echarts`, `vue-i18n`, `vue-virtual-scroller`, `vue3-bcui`, `vue3-lottie`, and `xss`.

The source also imports Node's `querystring`; Vite externalizes it for browser compatibility. Browser integration should replace that usage with `URLSearchParams`. Versions initially match `vendor/stapxs/package.json` except `echarts`, which is pinned to the compatible 5.6 line because `vue-echarts@7.0.3` rejects ECharts 6. The root lockfile is deliberately left for root integration.

## Validation and limits

`node frontend/src/modules/im/native/verify-source.mjs` verifies 115 files, hashes, and bootstrap exclusion. `npm run build:im-native --workspace frontend` builds the real exports from `index.ts` with 961 transformed modules and emits the referenced CSS assets. `git diff --check` verifies patch formatting. Build warnings remain for type-only imports that upstream did not mark with `import type`, Node/browser externalization, and dynamic/static chunk overlap. No runtime, visual, account-isolation, or protocol claim is made by this build proof.
