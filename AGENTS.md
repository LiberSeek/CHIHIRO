# Chihiro agent guide

This is **千寻 (Chihiro)** — a QQ IM workbench. Product repo: [LiberSeek/CHIHIRO](https://github.com/LiberSeek/CHIHIRO).

Read this before changing code. The old Stapxs **overlay** path is gone.

## Unified engineering migration (2026-09-14)

The user has authorized the `frontend/`, `backend/`, `deploy/` migration in
`docs/development-plan.md` and `docs/frontend-unification-plan.md`. Those paths
are the destination for new product code. The sections below describe the
legacy runtime while migration is in progress, not a requirement to retain
separate frontend applications.

- `frontend/src/modules/{im,agent,assistant}` owns migrated product UI. Extract
  the existing User* dependency closure with source/version/license records;
  do not import upstream app bootstrap files or introduce another createApp.
- `backend/src/{gateway,runtime,mcp}` owns migrated Node services. Keep root
  configuration/data paths stable and update scripts and deployment together.
- Keep the legacy shell available until real IM and Agent feature parity is
  verified; a placeholder build is not grounds to switch the default UI.
- Reference trees stay unchanged during extraction. NapCat remains read-only.
- The local `0.0.1` tag is the immutable migration baseline.


## What you are looking at

```text
Gateway :3100
  /                 apps/web          workbench shell (accounts, login, feature panel)
  /i/:instance/...  vendor/stapxs     IM (Stapxs, Chihiro-adapted, in-tree)
  /webui /api       NapCat Shell      live QQ runtime (not vendor/napcat)
  /astrbot          AstrBot           on-demand Bot / Dashboard
```

| Path | Role | Edit? |
|---|---|---|
| `apps/web` | Workbench UI | Yes |
| `apps/runtime` | NTQQ / NapCat / account lifecycle | Yes |
| `apps/gateway` | Reverse proxy on `:3100` | Yes |
| `vendor/stapxs` | **IM source of truth** | **Yes — edit files directly** |
| `vendor/napcat` | NapCat source for reading APIs | No (submodule, reference only) |
| `vendor/astrbot` | AstrBot Bot + ChatUI | **Yes on `develop` — edit `User*` copies, not upstream Chat.vue** |
| `overlays/` | Removed | Do not recreate |
| `data/` `.cache/` `dist/` | Local runtime / build output | Never commit |

Mac QQ: Runtime clones `data/runtimes/QQ.app`. Do not launch `/Applications/QQ.app` with `--no-sandbox` as the product path. Users must not run that by hand.

## Where a change belongs

1. Workbench / login / logout / account bar / feature panel → `apps/web`, `apps/runtime`, `apps/gateway`
2. Chat composer, history window, emoji, Stapxs menus, IM CSS → **`pages/user` / `components/user` (`User*`) and `assets/css/user.css`. Never edit upstream `Chat.vue`, `MsgBody.vue`, `FacePan.vue`, `chat.css`, `view.css`.**
3. OneBot / NTQQ protocol questions → read `vendor/napcat`, change Runtime if needed
4. Bot / Agent / ChatUI → `vendor/astrbot` `User*` UI + `apps/runtime` / `apps/web`. NapCat stays read-only.

Do not add string-replace overlays. Do not copy upstream files into `apps/`.

## Git

Origin: `https://github.com/LiberSeek/CHIHIRO.git`

| Branch | Purpose |
|---|---|
| `develop` | Daily Chihiro work. Default branch for agents. |
| `release` | Product cuts / tags |
| `master` | Frozen stable snapshot |
| `main` | Sync Stapxs upstream into `vendor/stapxs` only, then merge into `develop` |

Work on `develop`. Do not land IM or workbench features on `main`.

NapCat (`vendor/napcat`) stays a read-only submodule. AstrBot (`vendor/astrbot`) is a submodule with Chihiro branches: `master` pins upstream, `develop` holds `User*` ChatUI. Do not edit upstream `Chat.vue` / `FullLayout.vue`.

Stapxs pin: `vendor/stapxs/UPSTREAM`. Syncing upstream is a `main`-branch job (subtree/merge from `Stapxs-QQ-Lite-2.0` `next`), then merge `main` → `develop` and resolve conflicts in the files Chihiro already changed (`Chat.vue`, `chat.css`, `FacePan.vue`, `App.vue`, …).

## Commands

```bash
npm install
npm run check:layout
npm run dev              # http://127.0.0.1:3100/
npm run rebuild:im       # build vendor/stapxs → NapCat plugin dir
npm run rebuild:astrbot-ui  # build vendor/astrbot dashboard User* → dist
npm run mcp              # optional stdio MCP; prefer http://127.0.0.1:3100/mcp
npm run status
```

`rebuild:im` rsyncs `vendor/stapxs` to `.cache/stapxs-build` (keeps `node_modules`) and runs `yarn build:napcat`. There is no overlay apply step. After IM edits, rebuild and hard-refresh the workbench iframe.

Chihiro IM pages live under `vendor/stapxs/src/renderer/src/pages/user/` (`UserChat`, `UserMessages`, …). Upstream copies stay for merge. Default chat view is `UserChat`.

Chihiro ChatUI pages live under `vendor/astrbot/dashboard/src/components/user/` and `layouts/user/` (`UserChat`, `UserFullLayout`, …). After ChatUI edits: `npm run rebuild:astrbot-ui`, then restart AstrBot / hard-refresh the feature iframe.

Workbench PWA: `apps/web/manifest.webmanifest` + `sw.js`. Open `http://127.0.0.1:3100/` in Chrome/Edge and install to desktop (`display: standalone`). API / IM iframe / WebUI paths are not cached.

Frontend in `apps/web` is static (no HMR). Hard-refresh after shell changes too.

## Hard rules

- Never commit tokens, QR images, `data/`, `config/chihiro.local.json`, `dist/`, `.cache/`
- Never restore `overlays/stapxs` or `scripts/apply-stapxs-overlay.mjs`
- Never treat `vendor/napcat` as the place to ship Chihiro features
- AstrBot Chihiro UI goes in `User*` copies on `vendor/astrbot` `develop`, not upstream Chat.vue
- One official QQ container on Mac; isolated instances are cloned copies under `data/`
- Logout of an account stops that instance and deletes its isolated data; keep the shared clone
- Bot is on-demand, not a permanent daemon
- Gateway is the only URL the workbench should talk to

More detail: [README.md](README.md), [docs/iteration.md](docs/iteration.md), [docs/git-workflow.md](docs/git-workflow.md), [docs/product.md](docs/product.md).
