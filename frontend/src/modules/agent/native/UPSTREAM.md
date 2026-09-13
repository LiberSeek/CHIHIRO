# AstrBot UserChat source

This directory contains the recursive static source dependency closure of
AstrBot's Chihiro `UserChat.vue` component.

- Upstream: <https://github.com/AstrBotDevs/AstrBot>
- Pinned revision: `8b958b08e7fef3948d750d2891aabd80c0828f76`
- Source entry: `dashboard/src/components/user/UserChat.vue`
- License: GNU Affero General Public License v3.0 (`LICENSE`)
- Extracted: 2026-09-14

`source-manifest.json` records every copied source file and runtime package
observed by the extractor. Run `extract-astrbot-userchat.mjs` with an explicit
AstrBot `dashboard/src` path to reproduce the extraction.

The copied source preserves sessions, projects, structured messages, SSE and
WebSocket streaming, resume/stop/edit/regenerate, media input, rich rendering,
threads, workspace files, and provider/config workspaces. It deliberately does
not include AstrBot's `main.ts`, router/bootstrap, `ChihiroChatUI.vue`, mount
helpers, or its cross-application sidebar/main Teleport contract.

Chihiro adaptations are limited to module-owned import aliases, ordinary
in-tree layout roots in `UserChat.vue`, and explicit HTTP initialization that
does not replace the host application's global `window.fetch`. The HTTP
adaptation also keeps hosted mode in module state, uses private Axios instances,
and disables AstrBot dashboard login redirects and token cleanup when hosted.
