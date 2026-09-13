# 千寻统一前端与 Docker 交付开发计划

日期：2026-09-14。目标分支：develop。执行方式：先完成可审查的工程骨架和契约，再并行开发，最后由根任务统一集成、回归和发布验收。

## 目标

把千寻交付为一个完整产品：`frontend/` 是唯一 Vue 前端工程，`backend/` 是模块化 Node 后端，`deploy/` 管理 Docker 镜像和 Compose。Stapxs IM、AstrBot ChatUI、会话助手都成为同一前端中的模块。AstrBot Python 与 NapCat/NTQQ 仍是后端能力模块，不被强行揉成一个进程。

产品用户只接触一个 Gateway 地址。浏览器不再通过 iframe、动态 ChatUI IIFE 或跨应用 postMessage 组成主界面。账号、会话、Agent、任务和助手状态必须由统一前端显式管理。

## 当前约束

- 当前工作区已有未提交修改，任何任务不得重置、覆盖或清理无关改动。
- 继续遵守根 `AGENTS.md`：Stapxs 与 AstrBot 上游边界、NapCat 只读、禁止恢复 overlays、敏感数据不入仓。
- 当前运行路径仍是 `apps/web`、`apps/gateway`、`apps/runtime` 和 vendor 参考树。迁移期间保持可回退。
- 用户已明确允许自主规划和并行代理开发。本计划不要求中途审批。

## 终态目录

```text
frontend/                         唯一产品前端（一个 createApp / Pinia / Router）
  src/app/                        AppShell、providers、bootstrap
  src/router/                     统一路由
  src/stores/                     账号与产品状态
  src/api/                        Gateway clients、事件与协议类型
  src/components/                 公共布局、弹层、通知
  src/modules/im/                 Stapxs 派生 IM 模块
  src/modules/agent/              AstrBot ChatUI 派生 Agent 模块
  src/modules/assistant/          会话辅助与托管
  src/features/                   客户、线索、营销、任务、报告
  src/styles/                     tokens、主题、基础样式
  src/i18n/                       统一语言服务
  package.json / vite.config.ts
backend/                          产品 Node 后端
  src/gateway/                    静态服务、API、鉴权、SSE/WS 代理
  src/runtime/                    账号与外部服务生命周期
  src/core/                       客户、消息、策略、任务、发送队列
  src/connectors/                 QQ/NapCat 及其他通道
  integrations/astrbot/           AstrBot 插件和桥接
  contracts/                      API/事件 schema
  migrations/ / tests/
deploy/                           Docker 交付
  docker-compose.yml              标准组合
  docker-compose.dev.yml          开发覆盖
  docker-compose.external-napcat.yml
  astrbot.Dockerfile
  .env.example / config.example.yaml / scripts/ / README.md
Dockerfile                        chihiro 多阶段产品镜像
Makefile                          统一 build/test/image/up
vendor/                           上游来源和兼容参考
```

## 交付阶段

### P0 基线与契约

冻结当前 IM、ChatUI、Bot、账号、历史消息、草稿和附件能力清单；记录上游版本和许可证。定义 `AccountContext`、`ConversationKey`、`AgentSessionRef`、`RunEvent`、`OutboundAction` 等契约，明确账号归属和发送状态。完成前端单应用兼容原型，验证 Vue/Pinia/i18n/Vuetify 只有一份运行时。

验收：契约有运行时 schema 和类型测试；关键组件在同一应用中可渲染；旧入口仍可回退。

### P1 根工程与 Docker 骨架

建立 frontend/backend/deploy 目录和根 workspace；将 `apps/web` 的静态入口迁入前端工程骨架；建立统一 Makefile、Dockerfile 多阶段构建、Compose 环境变量、健康检查、数据卷和外部 NapCat 模式。先不搬迁全部业务文件。

验收：干净安装能构建 frontend/backend；镜像能启动并提供静态页/健康检查；AstrBot 与 NapCat 连接地址不写死 localhost；Mac 外部 NapCat 路径有清晰说明。

### P2 多账号会话层

将 Stapxs 的模块级 websocket、登录和重试状态改成 `AccountSessionManager`；所有消息、联系人、历史、附件、草稿和未读按账号/会话索引；替代 iframe 对 localStorage/sessionStorage 的隔离；迁移旧 instanceId 数据。

验收：两个账号相同 peerId 不串数据；A 请求完成不写入 B；切换账号期间发送目标不变；断线重连和移除账号释放全部订阅。

### P3 IM 模块迁移

提取 User* IM 组件、资源、历史、编辑器和宿主能力，改为 `frontend/src/modules/im`；删除对上游 main 的反向依赖、模块级启动副作用和产品路径中的 iframe。统一主题、语言、弹层、快捷键和附件服务。

验收：文字、表情、图片、文件、语音、视频、引用、撤回、历史分页和搜索按实际支持清单回归；IM 与账号上下文正确关联。

### P4 Agent 模块迁移

从当前 AstrBot User* ChatUI 提取 AgentWorkspaceProvider、AgentSidebar、AgentHeader、AgentThread。复用原生项目、会话、模型、流式输出、工具结果、线程、文件和多媒体能力；去掉独立 createApp、内存路由、全局 fetch 补丁、动态 IIFE 加载和双 Teleport 主布局。

验收：工作台侧栏和聊天区是普通组件；Agent 会话、项目、模型、流式、停止、附件和弹层功能通过；AstrBot Dashboard 仍可作为高级设置入口。

### P5 会话助手与业务基础

把机器人入口集成 IM 输入框，区分问助手和发给客户；实现人工/辅助/审核/自动模式、候选回复、证据、人工接管。后端将 JSON agent-store 逐步迁移至 SQLite 业务核心，建立 outbox、审批、发送尝试、结果未知和回执事件。

验收：客户原话和内部指示分开；旧草稿在新消息或人工接管后失效；重复审批不重复发送；前端状态只以真实发送状态为准。

### P6 业务能力

在统一工作台增加客户画像、购买意图、线索、跨群汇总、营销活动和跟进。所有批量触达使用受众快照、内容版本、配额、暂停/恢复、排除名单和逐项结果。主动加好友等 NapCat 能力先做能力矩阵，未经验证只提供待办。

验收：报告有来源引用和覆盖范围；营销活动可审查、暂停、恢复；客户回复后自动停止其后续营销任务。

### P7 发布切换

前后端、AstrBot、NapCat 版本组合形成 release manifest；Compose 提供标准 Linux 组合和外部 NapCat 组合；建立升级、备份、恢复、日志和回退。旧 iframe/动态挂载入口在新路径稳定后退役，保留短期回退镜像。

验收：干净机器从镜像启动；登录、收信、历史、Agent、草稿、发送、重启恢复通过；旧数据迁移和回滚演练通过。

## 并行任务拆分

- A：统一前端工程骨架和契约，负责 `frontend/` 新目录、根 workspace/构建入口、公共类型，不改现有 vendor 文件。
- B：Docker/Compose 发布骨架，负责 `Dockerfile`、`deploy/`、根 `Makefile` 和部署文档，不改前端业务。
- C：账号会话迁移设计与可测试适配层，负责 `backend/src` 新契约/测试或独立设计文档，不改 A/B 文件；先不替换现有连接逻辑。
- 根任务：审查代理结果，解决集成冲突，确认安全边界，补齐文档，运行测试和实际构建。

并行任务必须使用独立 worktree；代理完成后先验收，再回收。若 worktree 工具不可用，改为只读分析或新文件分区，不允许并发编辑同一文件。

## 测试门槛

每个阶段必须有：类型/单元测试、构建检查、`git diff --check`。P2 起加入 Playwright 多账号时序测试；P4 起加入 Agent SSE/WS、项目和弹层回归；P5 起加入审批幂等和发送状态机测试；P7 做 Docker 健康检查、数据卷、重启与回退验收。

前端性能基线记录首屏、首次切换、Agent 首 token、内存和资源体积。统一前端不等于把 Dashboard 全部静态资源放进首屏，Agent/Monaco/大型渲染器必须按路由或能力懒加载。

## 心跳与持续推进

当前工具环境没有可调用的外部自动化/heartbeat 调度器，也没有线程唤醒 API。因此不能在本轮创建一个独立于会话的后台心跳任务。执行期间由根任务在每个代理完成、每个构建阶段和固定时间间隔检查 `collaboration.list_agents`、worktree 状态、测试结果和未提交改动；如果会话被中断，下一次恢复先读取本计划和代理状态继续，不从头开始。

## 当前启动顺序

1. 写入本计划并核对工作区。
2. 分派 A/B/C 到独立 worktree。
3. 代理完成后审查、运行验收、回收代理。
4. 合并可用结果，继续下一个依赖阶段。
5. 只在可运行且可验证的垂直切片完成后切换默认入口。
