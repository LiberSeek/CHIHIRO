# 千寻产品模型（修订）

千寻不是「三个后台服务 + 一个反代」。  
它是一个 **QQ 风格工作台**：多账号、多应用；NapCat 是隐藏的协议基座，AstrBot 是可开关的应用。

---

## 1. NapCat / NTQQ：你的理解基本正确

Mac 上 NapCat **Shell** 必须拉起官方 **NTQQ**（QQ.app），并带 `--no-sandbox`。  
这是基座，不是给用户看的客户端。

纠正两点：

1. **用户不应自己执行** `QQ --no-sandbox`。那是千寻 Runtime 的内部动作。  
2. **一个 QQ 进程 ≈ 一个账号。** 同号不能同时开原生 QQ 和 NapCat。真·同时多开在 Mac 沙箱下很难（共用 `com.tencent.qq` 容器）。第一版「多账号」定义为：  
   - 工作台内账号列表  
   - 已登录过的号 **快速登录、免再扫码**（后端未退出则保持会话）  
   - 切换账号由千寻拉起/切换 Shell  
   - 同时在线多个号：后置（优先 Linux/独立数据目录方案）

### 目标启动流（对用户）

```text
打开千寻（Pake / 浏览器 / npm run dev）
    │
    ├─ Runtime 自动拉起 NTQQ --no-sandbox（无头/后台）
    ├─ 未登录 → 工作台内展示二维码（读 qrcode.png / WebUI 登录接口）
    ├─ 扫码成功 → 进入 IM（Stapxs）
    └─ 已有会话且后端未退出 → 直接进工作台，账号仍在线
```

不再出现「先开终端再开网页」的开发者流程（那只是当前脚手架现状）。

---

## 2. AstrBot：按「应用 / 插件」而不是常驻底座

你的理解正确：AstrBot 是 **LLM 自动回复与事件调度**，监听某人/某群/某事件后回复。

产品里它是 **可安装、可开关的应用**，不是一开机就占资源的总后台。

```text
用户在千寻「应用」里启用某个 AstrBot 应用
    → 千寻才拉起 AstrBot 进程（或容器）
    → 接到当前账号的 OneBot
    → 关闭应用 / 退出千寻后端 → 停掉 AstrBot
```

和 IM 的关系：

- IM（Stapxs）：人在工作台里聊天  
- AstrBot：后台按规则托管；会话级可「接管 / 托管」

---

## 3. 千寻要做成什么样

```text
千寻工作台（QQ 交互）
├── 账号栏     多账号：扫码添加 / 保持登录 / 切换
├── IM         Stapxs（主界面）
├── 应用       AstrBot 等多应用（按需启动）
└── 设置       NapCat 运维、OneBot、主题
         │
         ▼
    Chihiro Runtime
         ├── 管理 NTQQ+NapCat 进程与二维码
         ├── 每账号 OneBot HTTP/WS
         └── 按需拉起/停止 AstrBot
```

二次开发不可避免：协议（NapCat）、IM（Stapxs）、应用运行时（AstrBot）都会改。

---

## 4. 和当前脚手架的差距

| 现状 | 目标 |
|---|---|
| 人手 `QQ --no-sandbox` | 千寻 Runtime 拉起 |
| 终端/文件二维码 | 工作台登录页展示二维码 |
| 单账号手工连 Stapxs | 账号会话由 Runtime 维持 |
| AstrBot 独立常驻 | 应用开关才运行 |
| Gateway 只反代 | Runtime + 工作台壳 |

下一步工程：`apps/runtime`（进程/二维码/账号会话），登录页接入 Stapxs 之前。
