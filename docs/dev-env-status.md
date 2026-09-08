# Chihiro 本地开发环境检查（2026-09-08）

## 目录

```text
Chihiro/
  XRefs/
    linuxdo-wecom-ui/     # UI 参考（企微 IM 皮肤脚本）
    NapCatQQ/            # NapCat 源码 (v4.18.19 附近)
    AstrBot -> ~/AstrBot # 符号链接到本机 clone (v4.28.0)
  runtime/
    astrbot/             # AstrBot 运行实例与 data
  docs/
    dev-env-status.md    # 本文件
```

## 工具链

| 工具 | 状态 |
|---|---|
| Node | v22.19.0 |
| pnpm | 9.15.5 |
| Python | 3.13 系统；AstrBot 用 3.12 via uv |
| uv | 0.9.21 |
| astrbot CLI | 4.28.0（`uv tool install`） |

## AstrBot

| 项 | 状态 |
|---|---|
| XRefs | `Chihiro/XRefs/AstrBot` → `/Users/raven/AstrBot` |
| 源码版本 | v4.28.0 |
| 运行实例 | `Chihiro/runtime/astrbot` |
| Dashboard | http://127.0.0.1:6185 |
| 初始账号 | astrbot / （见启动日志，登录后请立即修改） |
| QQ 适配 | 未接（需 NapCat OneBot 先起来） |

启动：

```bash
export PATH="$HOME/.local/bin:$PATH"
cd /Users/raven/iWorking/RavenStudio/Products/PRODUCTION/LiberSeekAI/Chihiro/runtime/astrbot
astrbot run
```

## NapCatQQ

| 项 | 状态 |
|---|---|
| XRefs 源码 | `Chihiro/XRefs/NapCatQQ` @ v4.18.19-3-geecb0214 |
| 源码 node_modules | 未安装（源码开发用；日用跑 release Shell 即可） |
| 已安装 Shell 运行时 | `~/Library/Containers/.../Documents/napcat/` v4.18.19 |
| loadNapCat.js | 已存在于 Documents |
| QQ 版本 | 6.9.82-40990（官方支持的 Mac 版本之一） |
| 当前 QQ 模式 | **原生 GUI**（package.json main = application.asar） |
| WebUI :6099 | **未监听**（Shell 未启动） |
| OneBot :5800 | 配置存在（账号 308662170 曾开 HTTP），进程未起 |

### 为何现在不是 Shell

当前 `/Applications/QQ.app/.../package.json` 的 `main` 指向原生入口。  
Shell 需要：

1. `main` 改为 `Documents/loadNapCat.js`（安装器会做）
2. 用 `QQ --no-sandbox` 启动
3. 扫码/登录后 WebUI `127.0.0.1:6099`、OneBot 按配置监听

> 启动 Shell 会占用/切换 QQ 进程，**不要与原生 QQ 同号长期双开**。  
> 建议：主号继续原生；机号再开 Shell。若只有一号，启动 Shell 前先退出原生 QQ。

### 建议的 Shell 体验步骤（需你确认后再执行）

```bash
# 1. 退出当前原生 QQ
# 2. 备份并切换 package.json main -> loadNapCat.js（或用 NapCat-Mac-Installer）
# 3. 启动：
'/Applications/QQ.app/Contents/MacOS/QQ' --no-sandbox
# 4. 打开 http://127.0.0.1:6099/webui/
# 5. 在 WebUI 打开 OneBot：HTTP 127.0.0.1:5800 + WS（供 AstrBot / 千寻）
```

## 下一步开发规划（建议顺序）

1. **确认 NapCat Shell 可体验**：机号或临时切 Shell，打开 WebUI，验证 OneBot
2. **AstrBot 接 OneBot**：Dashboard 里加 QQ(OneBot) 适配器，感受自动回复
3. **定 Chihiro 工程骨架**：`apps/desktop-web` IM 主界面 + Settings 收纳官方 WebUI
4. **Phase 1 聊天闭环**：会话列表 / 历史 / 发送 / WS 实时
5. 再融合获客与 AstrBot 侧栏

## 安全备忘

- AstrBot 默认曾监听 `0.0.0.0:6185`，应改为 `127.0.0.1`
- NapCat WebUI / OneBot 仅绑 `127.0.0.1`
- 勿把 token / 初始密码提交进 git
