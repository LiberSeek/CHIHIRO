# Native Stapxs IM source closure

This directory preserves the pinned Chihiro `UserChat` and `UserMessages` source dependency closure as the starting point for single-app integration. It is extracted from the in-tree Stapxs reference at commit `7a895b964a67faf72f912370eb769adce16e37cc` (package `3.5.0`, AGPL-3.0-only).

The extraction is intentionally not presented as feature parity. `src/` retains the real message renderers, composer, history, stores, connector, and supporting settings/info code reached by static imports. Bootstrap imports use `host.ts`, so importing the module cannot create or mount a second Vue application. Subsequent strict TypeScript adaptations add event/data types, null checks and a host declaration file; changed source entries retain `extractedSha256` alongside their current hash. The product must call `configureNativeImHost` before rendering.

`source-manifest.json` records every extracted file and its post-transform SHA-256. Run:

```bash
node frontend/src/modules/im/native/verify-source.mjs
```

The verifier checks the recorded file list, hashes, and absence of upstream bootstrap imports or `createApp` calls. It does not prove runtime glob completeness or feature parity. Regenerate the closure only from the pinned reference tree and review every transform; do not silently edit generated source without updating the manifest and audit.

`/next/im` now installs and renders the native message list, contacts and chat in the existing app. The connector delegates to the root account session manager. Native stores still represent one active account, so switching invalidates requests and delayed work, clears state, selects account-specific settings and repeats the handshake. The Agent workbench is hosted by `frontend/src/modules/workspace/WorkspaceModule.vue` through ordinary Vue component targets; legacy `UserWorkbench.vue` / `AgentChatHost.vue` remain only as source-closure reference files and must not be used as the product entry. The legacy `/` shell remains the release default until full runtime parity is verified.

The six base stylesheets were extracted from product baseline `0.0.1`; their records include the product commit. Vite scopes native CSS to the IM module and overlay container. Pinyin search loads the npm `pinyin` package (MIT) as a local chunk instead of injecting a remote script.

After `npm run build:web`, run `npm run qa:native-im --workspace frontend` to exercise the built application against isolated HTTP/OneBot fixtures. It uses local Chrome by default; set `CHIHIRO_BROWSER` to another Chromium executable. Playwright checks contacts, history, composer dispatch, account switching, desktop/mobile layout and the IM/Agent round trip without starting real QQ. Screenshots and logs remain temporary artifacts. This does not replace real NapCat media, streaming Agent, or release-container acceptance.
