# 千寻 Chihiro

QQ IM 工作台。产品仓：[LiberSeek/CHIHIRO](https://github.com/LiberSeek/CHIHIRO)。

一套 IM 前端，多账号；聊天是主路径，Bot 按需开启。Agent 先读 [AGENTS.md](AGENTS.md)。

## 目录

```text
CHIHIRO/
├── AGENTS.md             给编码 Agent 的框架说明（先读）
├── backend/src/gateway   统一入口 :3100
├── backend/src/runtime   账号、QQ/NapCat 进程、二维码
├── backend/src/mcp       Codex / Claude stdio MCP
├── apps/web              旧工作台壳，统一前端迁移完成前保留
├── vendor/
│   ├── stapxs/           IM 主源码（直接改这里，已不是 overlay）
│   ├── napcat/           NapCat 对照（submodule，不要当产品代码改）
│   └── astrbot/          AstrBot 对照（submodule）
├── config/
├── scripts/
└── docs/
```

Stapxs 是 IM 视图；NapCat 是本机 QQ/OneBot 运行时；AstrBot 是按需自动化。后端服务在 `backend/src/`，当前默认工作台壳仍在 `apps/web`。迭代规则见 [docs/iteration.md](docs/iteration.md)。

## 分支

| 分支 | 用途 |
|---|---|
| `develop` | 日常开发（默认在这工作） |
| `release` | 发版 |
| `master` | 冻结的稳定快照 |
| `main` | 只用来把 Stapxs 上游合进 `vendor/stapxs`，再并入 `develop` |

## 运行

产品模型：[docs/product.md](docs/product.md)。  
Git：[docs/git-workflow.md](docs/git-workflow.md)。  
启动：[docs/START.md](docs/START.md)。

```bash
cp config/chihiro.local.example.json config/chihiro.local.json
npm install
npm run check:layout
npm run dev              # http://127.0.0.1:3100/
npm run rebuild:im       # 构建 vendor/stapxs 并安装到本机 NapCat 插件目录
npm run compose:up       # 使用 deploy/ 中的标准 Docker Compose 组合
```

改 IM（输入框、历史窗口、表情等）直接编辑 `vendor/stapxs`，然后 `npm run rebuild:im`，工作台硬刷新。不要再增加 overlay。
