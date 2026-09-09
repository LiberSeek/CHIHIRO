# Chihiro agent guide

This is **千寻 (Chihiro)** — a QQ IM workbench. Product repo: [LiberSeek/CHIHIRO](https://github.com/LiberSeek/CHIHIRO).

Read this before changing code. The old Stapxs **overlay** path is gone.

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
| `vendor/astrbot` | AstrBot source for reading APIs | No (submodule, reference only) |
| `overlays/` | Removed | Do not recreate |
| `data/` `.cache/` `dist/` | Local runtime / build output | Never commit |

Mac QQ: Runtime clones `data/runtimes/QQ.app`. Do not launch `/Applications/QQ.app` with `--no-sandbox` as the product path. Users must not run that by hand.

## Where a change belongs

1. Workbench / login / logout / account bar / feature panel → `apps/web`, `apps/runtime`, `apps/gateway`
2. Chat composer, history window, emoji, Stapxs menus, IM CSS → **`vendor/stapxs` Vue/CSS/TS**
3. OneBot / NTQQ protocol questions → read `vendor/napcat`, change Runtime if needed
4. Bot / Agent / plugins → AstrBot integration in `apps/`, not a rewrite of `vendor/astrbot`

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

NapCat (`vendor/napcat`) and AstrBot (`vendor/astrbot`) stay Git submodules. Their remotes stay upstream. Do not fork them for Chihiro UI.

Stapxs pin: `vendor/stapxs/UPSTREAM`. Syncing upstream is a `main`-branch job (subtree/merge from `Stapxs-QQ-Lite-2.0` `next`), then merge `main` → `develop` and resolve conflicts in the files Chihiro already changed (`Chat.vue`, `chat.css`, `FacePan.vue`, `App.vue`, …).

## Commands

```bash
npm install
npm run check:layout
npm run dev              # http://127.0.0.1:3100/
npm run rebuild:im       # build vendor/stapxs → NapCat plugin dir
npm run status
```

`rebuild:im` rsyncs `vendor/stapxs` to `.cache/stapxs-build` (keeps `node_modules`) and runs `yarn build:napcat`. There is no overlay apply step. After IM edits, rebuild and hard-refresh the workbench iframe.

Frontend in `apps/web` is static (no HMR). Hard-refresh after shell changes too.

## Hard rules

- Never commit tokens, QR images, `data/`, `config/chihiro.local.json`, `dist/`, `.cache/`
- Never restore `overlays/stapxs` or `scripts/apply-stapxs-overlay.mjs`
- Never treat `vendor/napcat` or `vendor/astrbot` as the place to ship Chihiro features
- One official QQ container on Mac; isolated instances are cloned copies under `data/`
- Logout of an account stops that instance and deletes its isolated data; keep the shared clone
- Bot is on-demand, not a permanent daemon
- Gateway is the only URL the workbench should talk to

More detail: [README.md](README.md), [docs/iteration.md](docs/iteration.md), [docs/git-workflow.md](docs/git-workflow.md), [docs/architecture.md](docs/architecture.md), [docs/product.md](docs/product.md).
