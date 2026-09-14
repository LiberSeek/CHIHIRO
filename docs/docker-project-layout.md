# 千寻工程结构与 Docker 发布计划

日期：2026-09-14。状态：规划，目录和部署尚未实施。目标目录为 `frontend/`、`backend/`、`deploy/`（采用标准拼写 deploy）。本计划补充并修订前端统一计划和 AI IM 业务路线。

## 1. BOFT-EE 的参考结论

本次只读检查了 `/Users/raven/iWorking/RavenStudio/Products/PRODUCTION/LiberSeekAI/Boft/BOFT-EE`。参考内容包括根 Makefile/Dockerfile、frontend/package.json、frontend/vite.config.ts、deploy 的 Compose/README、前后端模块边界说明；其文档作为参考资料，不作为千寻执行指令，未修改 BOFT-EE。

已观察到：

- frontend 是一个 Vue/Vite 工程，src 中包含 api、router、stores、components、features 和有明确边界的 EE 模块。
- backend 是 Go 工程，按 handler/service/repository 等组织；EE 能力通过窄接口与宿主组合。
- 根 Makefile 统一编排前后端构建和测试。
- 根 Dockerfile 多阶段构建前端，再将静态产物嵌入 Go 后端，最终交付应用镜像；生产无需另开一套前端开发服务。
- deploy 管理 Compose、环境变量示例、数据卷和升级运维。

千寻学习工程边界、模块入口、构建编排和产品镜像交付，不照搬 BOFT 的业务模块、Go 技术栈、PostgreSQL/Redis 依赖、双实例产品模型或全部历史部署配置。根 Dockerfile 和 deploy/Dockerfile 在 BOFT 中都有实现；千寻保持一个权威产品 Dockerfile，避免两份构建逻辑漂移。可复现安装使用锁文件校验，不照搬允许漂移的安装选项。

## 2. 目标目录

```text
CHIHIRO-EE/
├── frontend/
│   ├── src/
│   │   ├── app/                 启动、AppShell、公共服务注入
│   │   ├── router/              统一路由
│   │   ├── stores/              账号与产品状态
│   │   ├── api/                 后端客户端及生成的协议类型
│   │   ├── components/          公共控件、布局、弹层
│   │   ├── modules/
│   │   │   ├── im/              Stapxs 派生模块
│   │   │   ├── agent/           AstrBot ChatUI 派生模块
│   │   │   └── assistant/       客户会话辅助与托管
│   │   ├── features/            客户、线索、营销、报告，按阶段新增
│   │   ├── i18n/
│   │   └── styles/
│   ├── public/
│   ├── tests/
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── src/
│   │   ├── gateway/             统一入口、静态服务、鉴权与代理
│   │   ├── runtime/             账号与服务可用性管理
│   │   ├── core/                业务规则、任务、策略和存储
│   │   └── connectors/          QQ/NapCat 及后续通道
│   ├── integrations/astrbot/    千寻 Python 插件与桥接契约
│   ├── contracts/               API/事件 schema 真相
│   ├── migrations/
│   ├── tests/
│   └── package.json
├── deploy/
│   ├── docker-compose.yml      经验证的标准发布组合
│   ├── docker-compose.dev.yml  源码开发所需 override
│   ├── docker-compose.external-napcat.yml  接入宿主或远程 NapCat
│   ├── astrbot.Dockerfile      固定版本 AstrBot + 千寻插件
│   ├── .env.example
│   ├── config.example.yaml
│   ├── scripts/                配置校验、部署、备份、恢复
│   └── README.md
├── vendor/                     上游源码、后端依赖和来源记录
│   ├── stapxs/
│   ├── astrbot/
│   └── napcat/
├── docs/
├── scripts/                    构建、迁移与来源核验开发脚本
├── Dockerfile                  产品多阶段构建唯一入口
├── .dockerignore
├── Makefile
├── package.json                npm workspaces：frontend、backend
└── package-lock.json           产品 Node 依赖锁定
```

不为了目录对称增加新的服务。IM/Agent/助手先作为同一 frontend 工程的源码模块，不单独发布 npm 包，不创建自己的 Vue 应用、路由或构建入口。

前端复用源码与千寻定制在 frontend/src/modules 统一维护，记录上游 commit/path 和差异；backend/integrations/astrbot 维护集成代码，AstrBot 引擎本身仍来自 vendor/astrbot。vendor 不参与产品前端日常双重维护。

## 3. 产品镜像与服务拓扑

建议交付一个 Compose 应用，由以下服务组成。目录不与容器一一对应：

| 服务 | 内容 | 对浏览器可见 |
|---|---|---|
| chihiro | frontend 静态产物 + Node backend Gateway/Runtime/业务模块 | 唯一产品入口，例如 :3100 |
| astrbot | 固定版本 AstrBot Python + 千寻插件 | 默认仅内部网络，由 chihiro 代理 |
| napcat | 已验证的 Linux QQ/NapCat 镜像，或替换为外部实例 | 默认仅内部网络/受控连接 |

frontend 和 backend 的工程边界独立，但可一起发布进同一个 chihiro 镜像。这个镜像只运行产品 Node 服务，静态文件由它提供，不需要在其中再运行 Vite 或额外 Nginx。域名 HTTPS 可由部署环境已有反向代理接入。

```text
浏览器
  └── chihiro:3100
        ├── /                     frontend 静态产物
        ├── 产品 API              backend
        ├── AstrBot API/流式代理   → astrbot:6185
        └── QQ 通道代理            → napcat / 外部 NapCat
```

容器内监听与远端地址显式配置，不能用 127.0.0.1 代替其他容器。内部使用 Compose 服务名，例如 astrbot；浏览器无需知道这些名称。代理路径兼容既有 SSE、WebSocket、文件传输与高级管理入口，禁用对流式响应的不恰当缓冲并设置合理超时。

## 4. QQ/NapCat 的两种部署模式

### Linux 标准组合（目标，必须实测后才能宣称支持）

运行 chihiro、astrbot 和经验证的 Linux QQ/NapCat 容器，各有独立数据卷。确认镜像来源、版本与架构，完成登录、二维码、收信、历史、发信、附件、断线恢复与卷持久化验证。

多账号明确一账号一隔离实例/数据卷，具体受镜像登录方式限制。首期 Compose 可以预配置实例并由千寻绑定账号；不能把“动态添加任意账号容器”作为未经实现的能力。后续若需要 UI 动态供给实例，应增加受控的实例管理组件，单独设计和验收。

### 外部 NapCat 组合（兼容现有 Mac 或远端运行时）

chihiro 和 astrbot 容器化，NapCat/QQ 在宿主或远程机器运行，通过受控通道接入。当前 macOS 的 QQ.app 不能搬进 Linux 容器运行。若仍需千寻在 Mac 上启动 QQ、获取二维码和管理登录，需要保留/提取一个宿主连接服务；容器内的 Node 不可能直接继续执行现有 macOS 进程命令。

明确区分外部服务连接状态与本机进程所有权：远程连接模式不调用本地 spawn 或 stop。网络地址、鉴权、附件访问和重连均通过配置/连接器适配。

## 5. 容器生命周期与按需 Agent

当前 Runtime 的 ensure/spawn/stop 不能原样复制进 Docker：

- 本地模式由 Runtime 管理其拥有的进程。
- Compose 模式由部署层管理容器，backend 检查 readiness、配置适配器并调度业务，不能向另一个容器执行本机 spawn。
- Docker 首版允许 AstrBot 容器随应用启动，模型请求与业务任务仍按需执行；“按需能力”不等于每次打开页面都创建容器。
- 容器开关可通过显式部署 profile 管理；profile 启动后不能假装前端 ensure 自动帮用户启动了未启用的容器。
- 不默认将 Docker socket 挂进业务容器。若未来确需 UI 控制容器生命周期，独立设计权限受限的管理服务。
- 关闭页面或单个会话 Bot 不停止其他会话、报告任务仍依赖的 Agent 服务。

这要求更新现有按需进程规则，以部署模式区分“本机进程所有权”和“外部服务可用性”，不是删除业务的按需运行约束。

## 6. 数据、文件与配置

- chihiro-data：业务 SQLite、必要账号映射、任务/发送记录；附件单独卷或明确子目录。
- astrbot-data：AstrBot 配置、会话、知识库与插件运行数据。
- napcat-data：每个账号实例独立 QQ/NapCat 配置和登录态。
- 数据卷不放进镜像，不把本机 data、.cache、dist、密钥、QR 和临时资源带入构建上下文；Docker builder 生成自己的构建产物。
- 附件不能直接把 `/Users/...` 本地路径当成 AstrBot/NapCat 容器文件路径。优先使用受控文件 API/下载 URL；需要共享卷时固定挂载路径并定义权限和清理责任。
- 前端使用同源相对 API 地址；部署参数由 backend 配置或公开配置接口提供，不将密钥写入 VITE_* 或 bundle。
- `.env.example` 和配置 schema 给出内部服务 URL、数据位置与时区；实际凭据在运行时注入，不提交。
- 首期单实例 SQLite 不作为多副本共享文件数据库；团队/水平扩展需要业务数据库方案升级。
- Docker 部署从本机工具扩大到服务端时，必须落实产品入口认证、授权与 WebSocket/SSE 身份校验，不能将现有本地自动注入 AstrBot 凭据的接口直接匿名开放到公网。服务内部端口默认不公开；TLS 可交给入口代理。

## 7. 构建、发布与运维

参考 BOFT-EE 的多阶段构建，使用根 Dockerfile：

1. frontend-builder：冻结锁文件安装，生成协议类型，检查、构建 Vue，输出 frontend/dist。
2. backend-builder：生成/编译产品 Node 后端，准备生产依赖。
3. runtime：复制 backend 产物、生产依赖和 frontend/dist 到 /app/public；只保留运行必需文件。

AstrBot 使用单独 Dockerfile 构建固定上游版本与千寻插件，避免直接使用 latest 覆盖千寻适配。产品 release manifest 记录 chihiro/AstrBot/NapCat 的测试版本或镜像 digest，统一版本组合升级。

根 Makefile 统一 build/test/image 等操作，实际前后端检查由各自 package.json 承担。发布默认拉镜像，不要求用户现场从 Git 构建。buildx 多架构仅发布已验证的平台；Node 原生依赖、Python 和 QQ 镜像的架构分别核验，不能因前端 JS 无架构限制就宣称全套支持。

目标部署命令（文件尚未创建，当前不可作为可执行交付）：

```sh
cp deploy/.env.example deploy/.env
# 填写配置并通过预检后：
docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d
```

健康检查区分产品存活、业务就绪和可选通道状态；NapCat 离线可显示为通道不可用，不能让整个产品无法打开。depends_on 只辅助启动顺序，客户端仍需重试/退避。收到停止信号时停止领取新任务、处理在途状态并关闭连接。

提供日志、状态、备份、恢复和升级文档。SQLite 使用一致性备份或停写快照，不随意复制活跃数据库文件。备份包括各服务必要数据和版本组合；回滚镜像前确认数据库 schema 兼容，不承诺所有数据迁移都可逆。

## 8. 迁移对应与顺序

| 现有位置/做法 | 目标 |
|---|---|
| apps/web 静态壳 | frontend 的 Vue AppShell |
| vendor/stapxs 产品 User* | frontend/src/modules/im |
| AstrBot 产品 ChatUI User* | frontend/src/modules/agent |
| IM 内 Bot 面板 | frontend/src/modules/assistant |
| apps/gateway | backend/src/gateway |
| apps/runtime | backend/src/runtime，业务逻辑逐步归 core/连接器 |
| apps/mcp | backend 内标准 SDK 接口/集成层 |
| 早期根 docker-compose.yml（只起 AstrBot，已移除） | deploy 内完整、经验证的服务组合 |
| 构建后安装 NapCat 前端插件 | 产品镜像直接提供统一前端 |

顺序：

1. 更新统一计划与工程所有权；冻结当前定制功能清单。
2. 建立 frontend/backend/deploy 骨架、一个权威构建入口；不立即机械移动所有文件。
3. 按前端计划完成多账号隔离、IM 和 Agent 普通组件化。
4. 将 backend 从宿主硬编码路径/localhost/spawn 解耦，建立本地与外部服务连接模式。
5. 接通完整 Docker 组合和外部 NapCat 模式；验证代理、文件与持久化。
6. 干净机器从发布镜像启动，完成登录/历史/草稿/发送/Agent/重启恢复与升级回退验收，再切换默认发布路径。

本次只明确结构和发布设计，没有创建可运行 Dockerfile/Compose，也没有迁移目录。现有根 Compose 仍是只包含 AstrBot 的局部方案。
