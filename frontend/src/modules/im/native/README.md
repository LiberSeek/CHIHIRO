# Native Stapxs IM source closure

This directory preserves the pinned Chihiro `UserChat` and `UserMessages` source dependency closure as the starting point for single-app integration. It is extracted from the in-tree Stapxs reference at commit `7a895b964a67faf72f912370eb769adce16e37cc` (package `3.5.0`, AGPL-3.0-only).

The extraction is intentionally not presented as feature parity. `src/` retains the real message renderers, composer, history, stores, connector, and supporting settings/info code reached by static imports. Bootstrap imports use `host.ts`, so importing the module cannot create or mount a second Vue application. Subsequent strict TypeScript adaptations add event/data types, null checks and a host declaration file; changed source entries retain `extractedSha256` alongside their current hash. The product must call `configureNativeImHost` before rendering.

`source-manifest.json` records every extracted file and its post-transform SHA-256. Run:

```bash
node frontend/src/modules/im/native/verify-source.mjs
```

The verifier checks the recorded file list, hashes, and absence of upstream bootstrap imports or `createApp` calls. It does not prove runtime glob completeness or feature parity. Regenerate the closure only from the pinned reference tree and review every transform; do not silently edit generated source without updating the manifest and audit.

`npm run build:im-native --workspace frontend` compiles the actual public `index.ts` with the dedicated `vite.config.ts`. This proves dependency resolution only: the connector and Pinia stores remain module-level singletons and therefore are not accepted for concurrent accounts or wired into the default route.
