# vendor

| 目录 | 上游 | 在千寻里的角色 |
|---|---|---|
| `stapxs/` | [Stapxs-QQ-Lite-2.0](https://github.com/Stapxs/Stapxs-QQ-Lite-2.0) | **IM 主源码**，直接修改。钉住 `stapxs/UPSTREAM`。 |
| `napcat/` | [NapCatQQ](https://github.com/NapNeko/NapCatQQ) | submodule，协议对照。运行时用本机 NapCat Shell。 |
| `astrbot/` | [AstrBot](https://github.com/AstrBotDevs/AstrBot) | submodule。`master` 钉上游；`develop` 上改 `User*` ChatUI。 |

不要把 overlay 加回来。不要把千寻功能写进 napcat。AstrBot 只改 `User*` 副本，不改上游 Chat.vue。

见 [../AGENTS.md](../AGENTS.md) 与 [../docs/iteration.md](../docs/iteration.md)。
