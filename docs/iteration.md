# 千寻迭代契约

这份文档定义千寻如何吸收 AstrBot、NapCatQQ 和 Stapxs QQ Lite 的能力。它是产品仓的开发约定，不替代三个上游项目各自的开发文档。

## 1. 四层边界

| 层 | 产品仓位置 | 负责什么 | 千寻是否直接修改 |
|---|---|---|---|
| 产品壳 | `apps/web`、`apps/runtime`、`apps/gateway`、`apps/desktop` | 工作台、账号会话、进程生命周期、统一入口和桌面打包 | 是 |
| IM 视图 | `vendor/stapxs` + `overlays/stapxs` | OneBot IM 页面和 NapCat 插件静态资源 | 只改 overlay，不改 vendor |
| QQ 协议运行时 | 本机 NapCat Shell；`vendor/napcat` | NTQQ 注入、OneBot API/WebSocket、NapCat WebUI 和插件协议 | 不把本机运行态提交进仓库 |
| 自动化运行时 | AstrBot 镜像/源码；`vendor/astrbot` | 多平台适配、事件管线、Agent、插件和 Bot 托管 | 通过 API/OneBot/插件集成 |

核心原则是“产品代码组合上游能力”，而不是把三份上游代码拷贝成一个巨石：

```text
千寻 Gateway :3100
  ├─ /                    apps/web 工作台
  ├─ /i/:instance/plugin  Stapxs 构建出的 IM 页面
  ├─ /i/:instance/api     NapCat WebUI/API
  ├─ /i/:instance/onebot-ws  OneBot WebSocket
  └─ /astrbot             AstrBot Dashboard/API

apps/runtime
  └─ NTQQ --no-sandbox + NapCat Shell → OneBot v11
```

## 2. 三个上游分别怎么“学”

### Stapxs QQ Lite：学习前端和插件交付

Stapxs 自己支持 Web、Electron、Tauri、Capacitor 和 NapCat 插件。千寻选择它的 `build:napcat` 路径，因为这样能复用 QQ 会话、消息渲染和 OneBot 兼容层，同时让 Gateway 按账号实例隔离 iframe。

Stapxs 的产品差异只能进入 `overlays/stapxs/manifest.json`，例如：默认 OneBot 地址、千寻标题、独立 iframe 的存储前缀、关闭不需要的统计/引导。构建链是：

```text
vendor/stapxs
  → .cache/stapxs-build（复制，不污染上游）
  → apply-stapxs-overlay.mjs
  → yarn build:napcat
  → dist/plugins/napcat-plugin-ssqq
```

### NapCatQQ：学习协议边界和插件契约

NapCat 的 `packages/` 展示了 shell、framework、onebot、webui、plugin 等边界。千寻运行时依赖的是已安装的 NapCat Shell：读取其 live config/token，拉起 QQ 副本，分配 WebUI/OneBot 端口，然后通过 Gateway 代理。

`vendor/napcat` 只用于对照 API、配置格式和插件协议。不要把 `QQ.app`、二维码、token、数据库或 `data/` 运行态复制到仓库。

### AstrBot：学习适配器、事件管线和插件生态

AstrBot 的核心分为 `core/platform`、`core/pipeline`、`core/provider`、`core/star` 等模块，Dashboard 是独立前端。千寻把它视为可按需启用的自动化应用：通过同一个 OneBot/平台适配器接入当前账号，负责 Bot/Agent/插件任务，不取代 Stapxs 的日常聊天 UI。

## 3. 一次功能迭代怎么走

1. **先定位归属层。** 工作台/账号/进程改 `apps/`；IM 外观或默认连接改 overlay；QQ 协议问题先查 NapCat；自动回复、平台适配和插件能力先查 AstrBot。
2. **先写产品侧契约。** 明确输入、状态和对外路径。例如账号登录必须能从 `GET /api/runtime/stream` 观察到阶段，IM 必须使用实例前缀 `/i/:instance`。
3. **实现最小改动。** 不把上游文件复制到 `apps/`，不在 `vendor/*` 直接提交千寻功能。
4. **通过校验和构建。**

   ```bash
   npm run check:layout
   npm run build:stapxs
   npm run status
   ```

5. **运行验证。** 启动 `npm run dev`，验证添加 QQ、二维码、账号切换、IM iframe、设置入口；涉及 AstrBot 时再运行 `npm run compose:up` 并检查 `/astrbot`。
6. **提交边界清楚的变更。** 产品仓提交应用、文档、overlay 和更新后的 submodule 指针；上游自身的修复应回到上游仓库或独立分支，不在产品仓里伪装成 vendor 改动。

## 4. 吸收上游更新

先记录当前状态，再逐个更新，不要一次同时升级三套运行时：

```bash
npm run upstream:status

git -C vendor/stapxs fetch origin next
git -C vendor/stapxs checkout main
git -C vendor/stapxs merge --ff-only origin/next
git -C vendor/stapxs checkout develop
git -C vendor/stapxs merge main

# NapCat 使用 origin/main；AstrBot 使用 origin/master
npm run check:layout
npm run rebuild:im
```

如果 overlay 锚点不存在，先停止升级并查看上游变更；不要为了让构建通过而把 overlay 直接改成整文件复制。升级完成后提交产品仓的 submodule 指针，并在 PR 中记录三个上游的 commit/tag。

## 5. 不变量

- `vendor/stapxs`、`vendor/napcat`、`vendor/astrbot` 必须是 `.gitmodules` 声明的 submodule。
- `vendor/stapxs` 保持可从上游重新复制；千寻差异全部可在 `overlays/stapxs/manifest.json` 中审阅。
- token、二维码、账号数据库和 NapCat 本机配置只出现在 `config/chihiro.local.json`、环境变量或 `data/`，不进入 Git。
- Gateway 是唯一对工作台暴露的入口；前端不要硬编码另一个账号的 WebUI/OneBot 凭据。
- `dist/` 和 `.cache/` 是可重建产物，不是源码真相。
