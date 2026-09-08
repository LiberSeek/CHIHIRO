# 千寻 Chihiro · 三服务组织与交互

## 1. 三个服务分别怎么跑

| 服务 | 角色 | 本机怎么跑 | 端口 |
|---|---|---|---|
| **NapCat Shell** | QQ 协议运行时 + OneBot + 官方 WebUI | 本机 QQ `--no-sandbox`（Mac 安装器路径） | WebUI `6099`；OneBot HTTP `5800`；WS `5801` |
| **Stapxs QQ Lite** | QQ 风格 IM 前端（已验证） | NapCat **插件** `napcat-plugin-ssqq`，启用后打开扩展页 | 挂在 WebUI 同源 `/plugin/.../page/dashboard` |
| **AstrBot** | Agent / 自动化 / 插件生态 | `astrbot run` 或 Docker 镜像 | Dashboard `6185` |

### 数据流（聊天）

```text
手机/好友 QQ
    ↕
NapCat Shell (QQ 协议)
    ↕ OneBot WS :5801
Stapxs QQ Lite  ←── 你日常聊天 UI
```

### 数据流（自动化）

```text
群/私聊事件
    ↕ OneBot WS/HTTP
AstrBot  ←── 规则 / LLM / 获客插件
    ↕
NapCat 发消息
```

### 运维

```text
浏览器 / Pake 壳
    → Chihiro Gateway :3100
        → /im      → Stapxs
        → /webui   → NapCat 官方运维
        → /astrbot → AstrBot
```

---

## 2. 为什么要一个 Git 把它们「组合」

目标不是把三份源码糊成不可拆的巨石，而是：

1. **一个产品入口**（千寻）：启动、配置、桌面壳、文档  
2. **可持续吸收上游**：Stapxs / AstrBot / NapCat / Pake  
3. **UI 交互可改**：主要改 Stapxs 外观与默认连接，而不是重写协议  

推荐策略：**Git Submodule（或 subtree）+ overlays 覆盖层**。

```text
Chihiro/                          # 本仓库（产品）
├── apps/gateway                  # 统一入口反代（npm run）
├── apps/desktop                  # Pake 打包输出/配置
├── overlays/stapxs               # 你的 UI 补丁 / 默认主题 / 预填连接
├── upstream/                     # submodule：上游只读跟踪
│   ├── stapxs/                   # Stapxs-QQ-Lite-2.0
│   ├── astrbot/
│   ├── napcat/                   # 参考；Mac 日用不替代本机 Shell
│   └── pake/
├── config/                       # 端口与入口约定
├── scripts/                      # status / open / pake
├── docker-compose.yml            # 先容器化 AstrBot
├── XRefs/                        # 本地参考克隆（可不同步到远端）
└── runtime/                      # 本机运行态（gitignore 敏感数据）
```

### 吸收上游的工作流

```bash
# 跟踪 Stapxs 新版本
cd vendor/stapxs && git fetch && git checkout <tag>

# 你的改动放 overlays/stapxs，用脚本打到工作副本
npm run overlay:apply   # （下一步实现）

# 冲突只发生在 overlay 触及的文件，而不是整仓 rebase 地狱
```

**原则：**

- 上游目录尽量干净，便于 `git pull`  
- 产品差异进 `overlays/` 与 `apps/`  
- NapCat 在 Mac 上继续用 **本机 Shell 发行包**；源码 submodule 用于对照 API / 插件协议  

---

## 3. 交互怎么「顺畅」

统一约定：

| 用户动作 | 落到 |
|---|---|
| 打开千寻 | Gateway 首页或 Pake 直达 Stapxs |
| 聊天 | Stapxs ↔ `ws://127.0.0.1:5801` |
| 改网络/插件 | Settings → NapCat WebUI |
| 自动化 | AstrBot（同一 OneBot） |
| 桌面感 | Pake 包 Stapxs URL |

连接密钥（示例，本地 `config/chihiro.local.json`）：

- WebUI token → 打开插件页  
- OneBot WS token → Stapxs「连接密钥」  
- OneBot HTTP token → 脚本 / AstrBot HTTP  

---

## 4. 启动方式矩阵

| 方式 | 适用 |
|---|---|
| **本机 NapCat Shell** | 必须（Mac QQ） |
| **`npm run gateway`** | 统一入口 / 状态页 |
| **`docker compose up`** | AstrBot（可访问 host OneBot） |
| **`npm run pake:im`** | 桌面近似原生窗 |

不能期望「一个 Docker 在 Apple Silicon 上同时跑完整 QQ 协议 + UI」——协议层留在宿主机。

---

## 5. Pake

[tw93/Pake](https://github.com/tw93/Pake) 把网页打成轻量桌面应用。

千寻用法：

1. NapCat 已登录，Stapxs 插件已启用  
2. Gateway 可选（Pake 也可直链插件页）  
3. `npm run pake:im` → 生成「千寻」桌面应用  

这样交互路径接近原生：Dock 图标 → IM 窗 → 背后仍是 OneBot。
