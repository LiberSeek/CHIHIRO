# Runtime dependency provenance

Versions are preserved from AstrBot's pinned `dashboard/package.json` at
revision `8b958b08e7fef3948d750d2891aabd80c0828f76`. Licenses are the package
metadata published for those versions.

| Package | AstrBot version | License | Purpose in extracted closure |
|---|---:|---|---|
| `@guolao/vue-monaco-editor` | `^1.5.4` | MIT | Provider/config source editor |
| `@hey-api/client-axios` | `0.2.12` | MIT | Generated OpenAPI client |
| `@lucide/vue` | `^1.23.0` | ISC | Chat and project icons |
| `axios` | `1.13.5` | MIT | API transport and error handling |
| `dompurify` | `^3.3.2` | Apache-2.0 OR MPL-2.0 | Rich HTML sanitization dependency |
| `highlight.js` | `11.11.1` | BSD-3-Clause | Code highlighting compatibility |
| `katex` | `^0.16.27` | MIT | Mathematical notation rendering |
| `markdown-it` | `^14.1.1` | MIT | Markdown parsing compatibility |
| `markstream-vue` | `1.0.5-beta.0` | MIT | Streaming rich-message renderer |
| `mermaid` | `^11.12.2` | MIT | Diagram rendering |
| `monaco-editor` | `^0.52.2` | MIT | Code/config editor runtime |
| `qrcode` | `^1.5.4` | MIT | QR-code configuration fields |
| `shiki` | `^3.23.0` | MIT | Theme-aware syntax highlighting |
| `stream-markdown` | `^0.0.16` | MIT | Streaming Markdown compatibility |
| `vuetify` | `3.7.11` | MIT | Extracted component framework |

The unified frontend already owns Vue, Vue Router, and Pinia. Their root
versions satisfy the extracted module's APIs, so this module uses the root
instances and never creates a second application, router, or Pinia store.

The host also installs `@mdi/font` 7.4.47 for native Vuetify `mdi-*` controls
that were previously supplied by AstrBot's app-level stylesheet. The package
contains Apache-2.0 icons and OFL-1.1 fonts; its CSS/code is MIT.
