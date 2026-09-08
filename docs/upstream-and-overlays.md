# 上游吸收与 UI Overlay

## 目标

一个 Git 持续吸收：

- [Stapxs-QQ-Lite-2.0](https://github.com/Stapxs/Stapxs-QQ-Lite-2.0)（**UI 主修改面**）
- [AstrBot](https://github.com/AstrBotDevs/AstrBot)
- [NapCatQQ](https://github.com/NapNeko/NapCatQQ)（协议参考）
- [Pake](https://github.com/tw93/Pake)（桌面打包）

同时避免「fork 后永远合不回上游」。

## 推荐：Submodule + Overlay

```bash
git submodule add https://github.com/Stapxs/Stapxs-QQ-Lite-2.0.git vendor/stapxs
git submodule add https://github.com/AstrBotDevs/AstrBot.git vendor/astrbot
git submodule add https://github.com/NapNeko/NapCatQQ.git vendor/napcat
git submodule add https://github.com/tw93/Pake.git ../XRefs/Pake
```

### 你改 UI 时

1. 在 `overlays/stapxs/` 放补丁或替换文件清单（例如默认连 `127.0.0.1:5801`、隐藏多余入口、千寻主题）  
2. 构建 NapCat 插件版时：`vendor/stapxs` + overlay → 产出 `napcat-plugin-ssqq`  
3. 安装到本机 NapCat `plugins/` 或由脚本同步  

### 吸收上游时

```bash
cd vendor/stapxs
git fetch --tags
git checkout vX.Y.Z
cd ../..
# 重新 apply overlay；只解决 overlay 冲突
```

## 现阶段（未加 submodule 前）

本地已有参考克隆：

- `XRefs/NapCatQQ`
- `XRefs/AstrBot` → `~/AstrBot`
- `XRefs/linuxdo-wecom-ui`（布局参考）
- 已安装插件：`~/Library/.../NapCat/plugins/napcat-plugin-ssqq`

下一步再把 Stapxs 源码以 submodule 拉进 `vendor/stapxs`，并做第一条 overlay（默认 OneBot 连接）。

## 不要做的事

- 直接在 `Documents/napcat/static` 里改官方 WebUI 当主战场  
- 把 runtime token、二维码、数据库提交进 Git  
- 指望 Docker 在 Mac 上完全替代 NapCat Shell  
