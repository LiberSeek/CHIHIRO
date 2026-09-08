# vendor · 产品引用的上游源码

这三份是千寻实际构建/对照用的源码，位于产品仓内（git submodule / 嵌套 git）。

| 目录 | 上游 | 用途 |
|---|---|---|
| `stapxs/` | [Stapxs-QQ-Lite-2.0](https://github.com/Stapxs/Stapxs-QQ-Lite-2.0) | IM UI，主修改面（配合 `overlays/stapxs`） |
| `napcat/` | [NapCatQQ](https://github.com/NapNeko/NapCatQQ) | OneBot / 插件协议对照 |
| `astrbot/` | [AstrBot](https://github.com/AstrBotDevs/AstrBot) | 自动化对照与后续集成 |

`../XRefs/` 只放额外参考，不参与构建。

更新上游：

```bash
cd vendor/stapxs && git fetch --tags && git checkout <tag>
cd ../../
npm run rebuild:im
```
