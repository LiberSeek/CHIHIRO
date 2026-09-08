# Vendor 分支约定

三个 submodule 都在 `vendor/`：`stapxs`、`napcat`、`astrbot`。  
各自保留上游 remote `origin`，本地统一三套分支：

| 本地分支 | 用途 |
|---|---|
| **main** | **只接收上游更新**（跟踪上游默认分支，不在这写功能） |
| **master** | 千寻合入的稳定线（可发版、可给 overlay 打基线） |
| **develop** | 千寻日常二次开发 |

上游默认分支名并不统一，本地 `main` 这样跟踪：

| 仓库 | 上游默认分支 | 本地 `main` 跟踪 |
|---|---|---|
| stapxs | `origin/next` | `origin/next` |
| napcat | `origin/main` | `origin/main` |
| astrbot | `origin/master` | `origin/master` |

日常在 **develop** 上改；稳定了再并进 **master**。  
吸收上游：`main` rebase/merge 上游 → 再把需要的提交 cherry-pick/merge 到 `develop`。

```bash
# 吸上游（以 stapxs 为例）
cd vendor/stapxs
git checkout main
git fetch origin
git merge --ff-only origin/next   # 或对应上游默认分支

git checkout develop
git merge main                    # 或挑选提交
```

不要在 `main` 上直接做千寻功能，以免和下次 `fetch` 缠在一起。
