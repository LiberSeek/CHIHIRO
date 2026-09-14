# 千寻统一前端与 Docker 交付开发计划

日期：2026-09-14。目标分支：develop。执行方式：先完成可审查的工程骨架和契约，再并行开发，最后由根任务统一集成、回归和发布验收。

## 目标

把千寻交付为一个完整产品：`frontend/` 是唯一 Vue 前端工程，`backend/` 是模块化 Node 后端，`deploy/` 管理 Docker 镜像和 Compose。Stapxs IM、AstrBot ChatUI、会话助手都成为同一前端中的模块。AstrBot Python 与 NapCat/NTQQ 仍是后端能力模块，不被强行揉成一个进程。

产品用户只接触一个 Gateway 地址。浏览器不再通过 iframe、动态 ChatUI IIFE 或跨应用 postMessage 组成主界面。账号、会话、Agent、任务和助手状态必须由统一前端显式管理。

## 当前约束

- 当前工作区已有未提交修改，任何任务不得重置、覆盖或清理无关改动。
- 继续遵守根 `AGENTS.md`：Stapxs 与 AstrBot 上游边界、NapCat 只读、禁止恢复 overlays、敏感数据不入仓。
- 当前运行路径是 `apps/web`、`backend/src/gateway`、`backend/src/runtime` 和 vendor 参考树；统一前端预览位于 `/next/`。迁移期间保持可回退。
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

线程级 Codex 心跳 `automation-2`（千寻统一工程持续开发检查）已启用，每 30 分钟检查当前任务。2026-09-14 已通过 automation 工具和本地配置复核 `ACTIVE` 状态。它依赖 Codex 调度器，不是独立系统守护进程。恢复时读取本计划和实际 Git/agent 状态，避免重复启动；无可操作变化时保持安静，只在完成、失败或需要用户处理时通知。

## 当前启动顺序

1. 写入本计划并核对工作区。
2. 分派 A/B/C 到独立 worktree。
3. 代理完成后审查、运行验收、回收代理。
4. 合并可用结果，继续下一个依赖阶段。
5. 只在可运行且可验证的垂直切片完成后切换默认入口。

## 执行台账（2026-09-14，源码复核后）

- `0.0.1` 固定为原有功能基线，不移动标签。
- 根 npm workspace/锁文件、前端构建、`/next/` 静态预览已完成。正式 `/` 仍为旧壳；不能用预览构建替代功能验收。
- IM 只读/发送接口已加账号归属校验，工作区已有异步请求和草稿隔离测试；会话索引目前仅来自 Agent 追踪记录，不是完整 QQ 最近会话。
- Agent 现有页面是简化重写，并非原生源码迁移。确切差异见 `chatui-source-audit.md`，先前构建通过不能证明协议或功能兼容。
- 统一壳已使用 Runtime 的 `online` 字段，支持本地账号选择、可见错误和刷新；刷新时保留用户选择，清理过期请求。前端现有 20 项测试通过，包含 5 项账号状态测试。
- 进行中 A：`codex/astrbot-source-closure` / gpt-5.6-sol，复制固定版本 UserChat 的递归依赖到模块目录，保留 API/状态/渲染/媒体，记录来源和许可证，避免第二个应用启动。
- 进行中 B：`codex/backend-source-move` / gpt-5.5，将真实 Gateway/Runtime/MCP 代码迁入 backend，更新测试、路径和部署，停止只用兼容包装冒充迁移。
- 根任务：账号壳浏览器验收，独立审查上述产出，再合并。代理运行状态以协作工具为准，空 worktree 不代表任务已启动。
- 后续仍需：原生 IM 依赖迁移、完整会话/联系人和实时事件、原生 Agent 单应用安装与双区域布局、助手托管、业务模块、外部服务生命周期和 Docker 构建/启动验收。均不标记完成。

### 本批浏览器验收

2026-09-14：用隔离的本地 mock HTTP 服务加载真实 `frontend/dist`（不连接真实 QQ，不发测试消息）。验证 A/B 账号分别显示对应会话和消息、刷新保持本地账号选择、无浏览器控制台错误。375×812 截图发现 IM 两栏挤压和字色继承问题；已修复为窄屏列表/会话切换，输入框可见，返回列表可用。此验收覆盖壳与预览布局，不证明 QQ/AstrBot 真实协议或完整功能已经迁移。

### 后端源码迁移验收

`931ac35` 已将 Gateway、Runtime、MCP 的真实实现从 `apps` 搬至 `backend/src`，包含 QQ 克隆资源路径、测试和部署引用。`f88fa37` 修复 Node 22 测试目录发现方式。主工作区验证：后端 13 项测试、前端 20 项测试、类型检查、前端构建、布局检查通过。旧壳与 `/next/` 预览边界保持，源码搬迁验收未重启真实 QQ/Gateway，也未向真实联系人发送消息。

### 原生 ChatUI 接入预览

`8cdcfb2` 合入原生 UserChat 的 246 文件依赖闭包。统一应用 installer、普通双栏容器、`/agent/:conversationId?` 路由、移动端列表/聊天切换、toast 与图标字体已接入。独立 mock 服务加载真实构建，验证两条会话索引、指定会话历史、原生输入框、桌面与 375×812 布局，无控制台错误。原生构建约 2,900 模块且存在大 chunk；首屏拆包与主题样式隔离仍需优化。真实 AstrBot 流式/停止/附件/项目写入尚未验收，默认 `/` 不切换。

`a8930dd` 修复 ChatUI POST 请求体结束时过早中止 SSE，包含上游流持续和客户端取消两项回归测试；后端现有 15 项测试通过。`f58f826` 修复部署环境变量中的换行等字符导致 JSON 无效，临时目录验证 JSON 往返与配置权限通过。

### 外部 AstrBot 与当前验收边界

`4976d11` 增加明确的 external 生命周期，`6ef139b` 接通 Compose 配置和后端环境令牌。外部模式只探测指定 URL，不启动/终止进程，不写 AstrBot 配置；未提供账号反向地址时明确报错。修复本机 ensure 重复调用丢失进程所有权的问题。后端 21 项测试、语法检查、Compose config 展开通过；Docker 镜像启动和远端令牌获取/续期尚未验收。

`a6f55e1` 在打开原生 Agent 页面时先等待 Runtime ensure，失败可重试。原生会话 1 → 会话 2 路由与消息切换、创建项目弹层已经通过 mock 浏览器检查。真实写入、流式运行仍待验收。前端 20 项测试及原生构建通过。

IM 原生闭包已合入并完成 127 文件来源校验，包含 JSON 卡片组件与系统通知页。统一前端已补齐 native alias、运行时声明、动态资源插件和严格类型适配；`npm run typecheck:web`、`npm run build:web`、`npm run build:im-native --workspace frontend` 均通过。消息映射、卡片渲染、账号边界和 Agent hosted API 回归测试共 39 项前端测试通过。原生 IM 仍未切换为默认工作区模块：其模块级 Connector/Pinia 状态和全局 UI 仍需账号隔离、主题注册和真实 NapCat 会话验收，因此旧壳继续保留。

Docker 镜像已恢复统一前端构建阶段，同时继续将 `apps/web` 作为可回退根入口。本轮 Docker 内部 `npm ci`、类型检查和 Vite 构建通过，但复制前端产物时因磁盘不足引发 BuildKit `metadata_v2.db` I/O 错误；因此新镜像、容器健康和重启验收仍未通过。旧壳镜像的先前验证不代表统一前端镜像验收。已回收多个已提交且无工作区改动的临时 worktree，Git 分支/提交仍保留。`0.0.1` 基线标签保持不变。

### 下一批依赖顺序

1. 补齐原生 IM 的媒体、群资料、系统通知、弹层操作和错误反馈验收；宿主、基础 CSS、会话切换与文本历史已接入 `/next/im`。
2. 扩大账号切换后的异步操作回归，尤其上传、消息撤回、图片编辑和本地历史。已增加消息解析、延时任务及置顶/通知设置隔离，继续检查未覆盖的组件任务。
3. 完成 IM/Agent 共享交互、主题与弹层回归。`ImModule.vue` 已使用原生组件，正式 `/` 仍保留旧壳，不能用隔离 mock 验证替代真实服务功能验收。
4. 继续真实 AstrBot 流式、停止、项目、文件协议验收，再推进助手托管和业务能力。所有真实消息发送验证使用隔离测试目标，不向客户发送。
5. Docker 存储恢复后完成统一前端镜像导出和 `/next/` 深链接、资源、健康与重启验收；不重复执行已经证实受 I/O 故障影响的构建。

### 账号传输与原生连接门面（2026-09-14）

`7fbe4d0` 修复 Gateway 显式账号路由不得回退到活动账号的问题，27 项后端测试通过。统一前端已提供唯一 AccountSessionManager；OneBot 适配器使用同源 `/i/<accountId>/onebot-ws`，返回完整响应、校验账号身份，并处理超时、取消、连接失败、断线与迟到订阅。账号密钥只由 Gateway 注入。管理器收到断线事件后立即使连接失效，显式重试才建立新连接，不自动重放发送。

原生 Connector 已改为账号会话门面，移除了独立 WebSocket、SSE、轮询响应表和浏览器密钥持久化。NativeAccountBinding 在切换前失效、退订并取消本视图请求；失效后的响应不再 dispatch，await API 的旧结果抛出失效错误。新增 resetNativeAccountState 清理联系人、消息、通知、历史、Qzone、心跳和文件任务；握手重置保留刚选定的协议映射。

两项独立本地真实 WebSocket 集成测试验证了双账号 URL、响应归属、错账号推送拒绝和网络断线后的显式重连；测试服务不启动项目 Gateway、NapCat 或真实 QQ。前端测试累计 61 项通过，类型检查、统一前端构建、原生 IM 构建及 127 文件来源校验通过。

这一阶段完成时仍未接入原生路由；后续接入与验证记录如下。真实账号收信、完整历史、媒体发送与 Agent 实际协议验收继续保留为门槛。

### 原生 IM 路由与工作台贯通（2026-09-14）

`/next/im` 已通过现有根 app 懒加载原生 UserMessages、UserFriends、UserChat、系统通知、图片查看器和弹层。保留单一 Pinia 和账号连接管理器；六份基础样式取自 `0.0.1`，构建时限制到原生 IM/overlay 容器。列表中的工作台按钮切换到 AstrBot 原生 ChatUI，Agent 侧栏也提供消息/联系人/工作台入口。浏览器往返后仍只有一个 frame。

运行时验收定位并修复了 Logger/Option 循环依赖、握手重置丢失 NapCat 映射、原始 DOM tab 入口失效及基础样式缺失。拼音库改为本地 npm 依赖；账号置顶/通知设置使用独立 JSON 存储，统一前端外观配置不会覆盖旧壳的 `options`。消息解析与延时任务增加 generation 校验，Bot 会话本地开关加入账号前缀。

66 项前端测试、类型检查、统一前端构建与布局检查通过；135 文件来源校验通过。新增 `npm run qa:native-im --workspace frontend` 使用独立本地 HTTP/WS fixture 加载真实构建，验证联系人展开、历史显示、输入框发出归属于 A 账号的 send_msg、切换 B 清除 A 内容、390px 页面无横向溢出，以及 IM → Agent → IM，无浏览器错误。桌面/手机截图已人工检查。此处的发送仅发生于测试 WebSocket，未启动真实 QQ；不宣称已完成真实发送回执、文件/媒体和 Agent 流式验收。

剩余核心工作：移除原生 UserChat 内遗留的 parent.postMessage 宿主交互，接通统一会话助手；补全媒体/群资料等功能验收；继续业务能力与 Docker 发布验证。`/next/` 是开发预览，正式 `/` 的默认入口尚未切换。

### 会话助手接入与发送回执（2026-09-14）

已移除迁移版 UserChat 的 parent.postMessage、Bot localStorage 开关和虚假的本地审批清空。机器人图标现在打开输入框上方的原生助手面板；支持会话托管、逐条审核/敏感内容审核/全部自动、引用客户消息询问助手、查看后端处理步骤与草稿、确认发送和丢弃。独立会话助手路由复用同一状态。账号与私聊/群聊完整标识随请求发送；切换时取消请求、关闭 SSE，迟到结果不会进入新会话。

后端草稿在发送前同步从 pending 占用为 sending；重复审批不再重复触达 QQ，成功保存实际 message_id 回执，发送中断或缺少回执变为 unknown，启动恢复时同样把遗留 sending 标为 unknown。新增 recentDrafts 保留近期发送状态，同时保留旧壳 drafts 仅返回 pending 的兼容语义。新会话可以先设置审核模式；关闭托管先通过 `/api/runtime/agent/takeover` 使待审草稿失效并保持后续回复待审。提问产生的多个回复片段持续待审，重新设置模式才解除辅助审核。自动回复也经草稿发送通道取得真实回执，不再提前报告成功。待审回复给 AstrBot 的结果包含 draft_id 和 pending_review，message_id 为 0，未伪造 QQ 消息 ID。

本批通过 72 项前端测试、36 项后端测试、类型检查、统一前端构建、布局检查及 135 文件来源校验。隔离 HTTP/WS/SSE 浏览器测试覆盖机器人入口、内部提问、审核发送、开启托管、桌面与 390px 输入框布局、多账号切换、IM/工作台往返，无控制台错误、仅一个 frame。截图为 `/tmp/chihiro-im-assistant-desktop.png` 与 `/tmp/chihiro-im-assistant-mobile.png`。所有发送只到模拟接口，未启动真实 QQ/Gateway。

磁盘不足一度使构建写入失败；回收已结束的 im-native-closure 任务的可重装 node_modules 后恢复构建，该 worktree 的源码和未提交变更保留。本批后端子任务提交 `978fe68` 已验收合入为 `47a966b`，干净任务 worktree 已回收。

P5 仍未全部完成：当前 JSON 存储的同步占用只适用于单进程 Runtime，仍需 SQLite/outbox、按会话发送顺序、在途任务取消与人工直接 IM 发送联动。托管启动失败恢复、真实 AstrBot 多媒体/工具协议与完整 Agent 会话流仍需验收。P3/P4 媒体与真实服务验收、P6 业务能力、Docker 发布与数据迁移回退保持未完成；不切换正式默认入口、不推送远端、不移动 0.0.1。
