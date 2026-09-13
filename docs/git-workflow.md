# Git 约定

产品仓 origin：`https://github.com/LiberSeek/CHIHIRO.git`

## 产品仓分支

| 分支 | 用途 |
|---|---|
| **develop** | 日常开发。Agent 和新功能都在这。 |
| **release** | 发版、打 tag。 |
| **master** | 冻结的稳定快照。 |
| **main** | **只接收 Stapxs 上游**。把官方 `next` 合进 `vendor/stapxs`，再 merge 到 `develop`。不要在 main 上做工作台或 IM 功能。 |

```bash
git clone https://github.com/LiberSeek/CHIHIRO.git
cd CHIHIRO
git checkout develop
git submodule update --init vendor/napcat vendor/astrbot
```

## vendor 怎么管

| 目录 | 形态 | 远程 |
|---|---|---|
| `vendor/stapxs` | 本仓普通目录（IM 主源码） | 上游记录在 `vendor/stapxs/UPSTREAM` |
| `vendor/napcat` | submodule | `https://github.com/NapNeko/NapCatQQ.git`（默认 `main`） |
| `vendor/astrbot` | submodule | `https://github.com/AstrBotDevs/AstrBot.git`（默认 `master`） |

NapCat、AstrBot 更新慢，也几乎不改源码，继续 submodule。Stapxs 是 IM 本体，直接改文件，用 `main` 分支吸收上游。

### 吸收 Stapxs

在干净的 `main` 上操作（示例，按当时仓库状态选 subtree 或 checkout 合并）：

```bash
git checkout main
git pull origin main
# 将 Stapxs-QQ-Lite-2.0 的 next 合入 vendor/stapxs
# 更新 vendor/stapxs/UPSTREAM 里的 commit
git checkout develop
git merge main
npm run check:layout
npm run rebuild:im
```

冲突只解决 `vendor/stapxs` 里千寻改过的文件，不要为了「干净」把千寻 UI 改回去。

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
