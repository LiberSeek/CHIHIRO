# 千寻迭代契约

给产品仓用的开发约定。上游项目各自的文档仍然有效，这里只定义千寻怎么用它们。

## 1. 四层边界

| 层 | 位置 | 负责什么 | 怎么改 |
|---|---|---|---|
| 产品壳 | `apps/web`、`apps/runtime`、`apps/gateway`、`apps/desktop` | 工作台、账号、进程、入口 | 直接改 |
| IM | `vendor/stapxs` | 会话、消息、输入框、历史窗口、表情 | **直接改这些文件** |
| QQ 协议运行时 | 本机 NapCat Shell；`vendor/napcat` 只读对照 | NTQQ、OneBot、WebUI、插件协议 | 不把运行态提交进仓 |
| 自动化 | 本机/容器 AstrBot；`vendor/astrbot` 只读对照 | 事件管线、Agent、插件 | 经 API / OneBot 接入 |

```text
千寻 Gateway :3100
  ├─ /                    apps/web
  ├─ /i/:instance/plugin  vendor/stapxs 构建出的 IM
  ├─ /i/:instance/api     NapCat WebUI/API
  ├─ /i/:instance/onebot-ws
  └─ /astrbot             AstrBot Dashboard
```

已经废弃：`overlays/stapxs`、运行时字符串替换、把 Stapxs 当只读 submodule。

## 2. 三个上游

### Stapxs：IM 主项目

千寻吃它的 `build:napcat` 路径。源码在 `vendor/stapxs`，是本仓普通目录。钉住信息在 `vendor/stapxs/UPSTREAM`。

构建：

```text
vendor/stapxs
  → .cache/stapxs-build（复制，保留 node_modules）
  → yarn build:napcat
  → dist/plugins/napcat-plugin-ssqq
```

改 composer、历史、表情、菜单、默认连接，都在 `vendor/stapxs/src/renderer/src/pages/user` 与 `components/user` 的 `User*` 文件里改。上游 `Chat.vue` 等不要当产品 UI 改。默认聊天面板是 `UserChat`。

### NapCatQQ：协议对照

运行时用已安装的 NapCat Shell。`vendor/napcat` 用来读 API 和配置格式。不要把 `QQ.app`、二维码、token、`data/` 提交进仓。不要为了改 UI 去 fork NapCat。

### AstrBot：按需 Bot

Dashboard 和事件管线是对照源。产品里 Bot 是开关，不是常驻守护进程。不要把千寻功能写进 `vendor/astrbot`。

## 3. 一次功能怎么走

1. 先定位层：壳 → `apps/`；IM → `vendor/stapxs`；协议 → NapCat；Bot → AstrBot 集成。
2. 直接改对应文件。不要新增 overlay JSON。
3. 校验：

   ```bash
   npm run check:layout
   npm run rebuild:im    # 仅当动了 vendor/stapxs
   npm run status
   ```

4. `npm run dev` 验证登录、切账号、IM iframe、设置窗。IM 变更后硬刷新 iframe。
5. 提交打在 `develop`。

## 4. 吸收 Stapxs 上游

在 **`main`** 上把 [Stapxs-QQ-Lite-2.0](https://github.com/Stapxs/Stapxs-QQ-Lite-2.0) 的 `next` 合进 `vendor/stapxs`，再把 `main` 并入 `develop`。冲突会出现在千寻改过的文件上，这是预期的。

NapCat / AstrBot 仍用 submodule 指针升级，且不要和 Stapxs 同一次乱升。

```bash
npm run upstream:status
npm run check:layout
```

## 5. 不变量

- `vendor/stapxs` 是本仓源码，不是 submodule。
- `vendor/napcat`、`vendor/astrbot` 是 `.gitmodules` 里的对照 submodule。
- 不存在、也不要恢复 overlay 构建链。
- token、二维码、账号库只出现在 `config/chihiro.local.json`、环境变量或 `data/`。
- Gateway 是工作台唯一入口。
- `dist/`、`.cache/` 可重建，不是源码真相。
