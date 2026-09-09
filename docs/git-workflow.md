# 千寻与上游的 Git 约定

三个 submodule 都在 `vendor/`：`stapxs`、`napcat`、`astrbot`。产品仓自己的分支和 submodule 内部的分支是两层不同的事情：根仓只提交 submodule 指针，功能代码放在 `apps/` 和 `overlays/`。

## Submodule 分支

各上游目录保留 `origin`，并使用以下本地分支角色：

| 本地分支 | 用途 |
|---|---|
| **main** | **只接收上游更新**（跟踪上游默认分支，不在这写千寻功能） |
| **master** | 可选稳定线；需要固定基线或发版时使用 |
| **develop** | 千寻日常二次开发和验证 |

上游默认分支名并不统一，本地 `main` 这样跟踪：

| 仓库 | 上游默认分支 | 本地 `main` 跟踪 |
|---|---|---|
| stapxs | `origin/next` | `origin/next` |
| napcat | `origin/main` | `origin/main` |
| astrbot | `origin/master` | `origin/master` |

日常在 **develop** 上改；稳定了再并进 **master**。当前三个 submodule 的 `develop`、`main`、`master` 可能暂时指向同一个上游 commit，这是正常的；不要因为分支名相同就把产品代码写进 `main`。

吸收上游：`main` 快进上游 → 再把需要的提交合入 `develop`。

```bash
# 吸收上游（以 Stapxs 为例）
cd vendor/stapxs
git checkout main
git fetch origin
git merge --ff-only origin/next   # 或对应上游默认分支

git checkout develop
git merge main                    # 或挑选提交

cd ../..
npm run check:layout
npm run rebuild:im
```

NapCat 使用 `origin/main`，AstrBot 使用 `origin/master`。如果 `check:layout` 报 overlay 锚点漂移，先阅读上游变更并更新 manifest；不要把整个上游文件复制到 `overlays/`。

## 产品仓提交

根仓的一个上游升级提交应包含：submodule 指针、必要的 overlay/产品代码、校验和构建结果。不要提交 `data/`、`.cache/`、`dist/`、token、二维码或本机 NapCat 配置。
