# Stapxs UI Overlay

把千寻对 Stapxs 的 UI/交互改动放这里，而不是直接改 `vendor/stapxs`。

计划中的第一批改动：

1. 默认连接地址 `127.0.0.1:5801`
2. 默认填入 OneBot WS token（构建时注入或首次引导）
3. 侧栏增加「设置 / AstrBot」入口（链到 Gateway）
4. 窗口标题改为「千寻」

落地方式（下一步）：
- 文件级 copy overlay
- 或 `patch -p1` 系列补丁
