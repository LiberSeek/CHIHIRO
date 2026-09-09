# 上游依赖（原 overlay 文档）

**Overlay 已废弃。** 旧的 `overlays/stapxs/manifest.json` 已一次性打进 `vendor/stapxs`。不要重建字符串替换层。

| 上游 | 在本仓里 | 改法 |
|---|---|---|
| [Stapxs-QQ-Lite-2.0](https://github.com/Stapxs/Stapxs-QQ-Lite-2.0) | `vendor/stapxs` 普通目录 | 直接改；`main` 上同步官方 `next` |
| [NapCatQQ](https://github.com/NapNeko/NapCatQQ) | `vendor/napcat` submodule | 只读对照；Mac 日用本机 Shell |
| [AstrBot](https://github.com/AstrBotDevs/AstrBot) | `vendor/astrbot` submodule | 只读对照；按需跑实例 |

构建 IM：

```bash
npm run rebuild:im
```

这会把 `vendor/stapxs` 同步到 `.cache/stapxs-build` 再 `yarn build:napcat`。没有 apply overlay 步骤。

完整约定见 [AGENTS.md](../AGENTS.md)、[iteration.md](iteration.md)、[git-workflow.md](git-workflow.md)。
