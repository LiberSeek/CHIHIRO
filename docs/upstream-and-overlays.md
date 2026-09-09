# 上游吸收与 UI Overlay

## 当前约定

一个 Git 持续吸收：

- [Stapxs-QQ-Lite-2.0](https://github.com/Stapxs/Stapxs-QQ-Lite-2.0)（**UI 主修改面**）
- [AstrBot](https://github.com/AstrBotDevs/AstrBot)
- [NapCatQQ](https://github.com/NapNeko/NapCatQQ)（协议参考）
- [Pake](https://github.com/tw93/Pake)（桌面打包）

同时避免“fork 后永远合不回上游”。当前三个目录已经是 Git submodule；产品代码不直接写入 `vendor/*`。

## 目录职责

`vendor/stapxs` 是唯一参与千寻构建的上游源码。`vendor/napcat` 和 `vendor/astrbot` 主要用于协议、适配器和插件架构对照；运行时分别使用本机 NapCat Shell 和 AstrBot 镜像/安装环境。

```text
apps/       千寻产品代码
overlays/   对上游的可审阅差异
vendor/     可更新的上游 submodule
dist/       可重建产物（不提交）
data/       本机运行态（不提交）
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

### 构建和校验

```bash
npm run check:layout
npm run build:stapxs
npm run install:stapxs
```

`build:stapxs` 会将 `vendor/stapxs` 复制到 `.cache/stapxs-build`，应用 `overlays/stapxs/manifest.json`，再构建 `napcat-plugin-ssqq`。上游目录本身保持干净。

## 不要做的事

- 直接在 `Documents/napcat/static` 里改官方 WebUI 当主战场  
- 把 runtime token、二维码、数据库提交进 Git  
- 指望 Docker 在 Mac 上完全替代 NapCat Shell  
