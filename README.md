# 千寻 CHIHIRO-CE（产品仓）

QQ 工作台产品代码。工作区在上一级 `Chihiro/`。

## 目录

```text
CHIHIRO-CE/
├── apps/gateway          统一入口（npm run gateway）
├── apps/desktop          Pake 桌面壳脚本
├── overlays/stapxs       UI / 默认连接补丁
├── vendor/
│   ├── stapxs/           Stapxs 源码（构建 IM 插件）
│   ├── napcat/           NapCat 源码（协议对照）
│   └── astrbot/          AstrBot 源码（自动化对照）
├── config/
├── scripts/
├── docs/
└── docker-compose.yml
```

## 运行

需本机 NapCat Shell 已登录（`QQ --no-sandbox`）。

```bash
cd /Users/raven/iWorking/RavenStudio/Products/PRODUCTION/LiberSeekAI/Chihiro/CHIHIRO-CE
cp config/chihiro.local.example.json config/chihiro.local.json
npm install
npm run gateway          # http://127.0.0.1:3100/
npm run rebuild:im       # overlay + 安装到本机 NapCat 插件目录
npm run open:im
npm run pake:im          # Web 跑通后再打桌面壳
```
