# Git 约定

产品仓 origin：`https://github.com/LiberSeek/CHIHIRO.git`

## 产品仓分支

| 分支 | 用途 |
|---|---|
| **develop** | 日常开发。Agent 和新功能都在这。 |
| **main** | 对外发布、GitHub 默认分支。发版时从 `develop` 快进或合并过来。 |
| **release** | 冻结。不再作为发版线。 |
| **master** | 冻结的稳定快照。不再推进。 |

```bash
git clone https://github.com/LiberSeek/CHIHIRO.git
cd CHIHIRO
git submodule update --init vendor/napcat vendor/astrbot
```

日常开发：`git checkout develop`。不要在 `main` 上直接改功能。

## vendor 怎么管

| 目录 | 形态 | 远程 |
|---|---|---|
| `vendor/stapxs` | 本仓普通目录（IM 主源码） | 上游记录在 `vendor/stapxs/UPSTREAM` |
| `vendor/napcat` | submodule | `https://github.com/NapNeko/NapCatQQ.git`（默认 `main`） |
| `vendor/astrbot` | submodule | `https://github.com/AstrBotDevs/AstrBot.git`（默认 `master`） |

NapCat、AstrBot 更新慢，也几乎不改源码，继续 submodule。Stapxs 上游合入走 `develop` 上的专题分支，不要占用 `main`。

### 吸收 Stapxs

从干净的 `develop` 拉专题分支（示例，按当时仓库状态选 subtree 或 checkout 合并）：

```bash
git checkout develop
git pull origin develop
git checkout -b upstream/stapxs
# 将 Stapxs-QQ-Lite-2.0 的 next 合入 vendor/stapxs
# 更新 vendor/stapxs/UPSTREAM 里的 commit
git checkout develop
git merge upstream/stapxs
npm run check:layout
npm run rebuild:im
```

冲突只解决 `vendor/stapxs` 里千寻改过的文件，不要为了「干净」把千寻 UI 改回去。合入 `develop` 后，发版再把 `develop` 推到 `main`。

### 升级 NapCat / AstrBot

```bash
git -C vendor/napcat fetch origin
git -C vendor/napcat checkout main
git -C vendor/napcat merge --ff-only origin/main

git -C vendor/astrbot fetch origin
git -C vendor/astrbot checkout master
git -C vendor/astrbot merge --ff-only origin/master
git -C vendor/astrbot checkout develop
git -C vendor/astrbot merge master
# 冲突只解决 User* 与胶水文件，不要把千寻 UI 改回上游 Chat.vue
```

根仓提交的是 **submodule 指针**，不要把这两个目录变成普通文件夹。

## 不要提交

`data/`、`.cache/`、`dist/`、token、二维码、`config/chihiro.local.json`、本机 NapCat 配置。
