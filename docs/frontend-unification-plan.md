# 千寻统一前端工程计划

日期：2026-09-14。状态：待实施的技术计划。本次仅规划，不迁移代码、不改运行中的服务。

部署与目录补充：目标产品目录为 `frontend/`、`backend/`、`deploy/`；以 Docker Compose 交付。详细运行边界见 `docker-project-layout.md`。

用户确定的目标：营销、客服、运营 AI IM；前端由一个工程统一维护与管理，后端保持模块化。本文定义前端统一工程的终态和迁移顺序，承接 `ai-im-roadmap.md` 的业务方向。

依据为仓库现有源码与依赖声明，不代表已验证上游最新版本兼容性。当前工作区包含已有未提交改动，迁移不得覆盖这些成果。

## 1. 统一的完成定义

最终交付：

1. 一个产品前端入口：`frontend`，一个 HTML 入口、一个 `createApp`、一个根 Pinia、一个 Vue Router、一个顶层布局。
2. 一个根 workspace 安装入口和锁文件管理产品前端依赖；一个 Vite 配置负责整个产品前端构建。代码按模块拆分、按路由懒加载，不等于打成一个巨大 JS。
3. Stapxs IM、AstrBot ChatUI、会话辅助和业务页面成为编译期导入的 Vue 模块，不再以 iframe 或运行时下载另一个应用的脚本集成。
4. 账号、工作空间、主题、语言、导航、通知、弹窗和平台能力由产品提供；模块不得各自创建应用、路由或改写宿主全局对象。
5. 消息、联系人、Agent 会话以及未来线索/任务/报告在同一交互系统中协作。客户会话 ID 与 Agent 会话 ID 保持不同类型，通过明确上下文关联。
6. 浏览器仅通过 Gateway 访问后端。Node Runtime、AstrBot Python、NapCat/NTQQ 仍可独立运行。
7. 产品开发不再要求分别构建 IM 插件和 ChatUI 库。维护者需要调试上游完整 Dashboard 时，可以保留其独立参考工程；它不参与日常产品构建。

只把三份 package.json 放进 monorepo，或只去掉外层 iframe，不视为完成统一。

## 2. 现状、风险与决策

| 当前实现 | 迁移影响 | 决策 |
|---|---|---|
| `apps/web/app.js` 手动维护账号 iframe 和 postMessage | 壳与业务状态隔离，布局重复 | 将壳迁为 Vue 组件；通信改为类型化服务/状态/事件 |
| Stapxs `main.ts` 自行创建 Vue、Pinia、i18n，业务文件反向导入 main | 导入组件可能启动第二个应用或形成入口循环 | 独立模块入口，移除产品依赖中的启动副作用 |
| `connect.ts` 的模块级 websocket、login 和重试状态 | 同一窗口多账号会互相覆盖 | 每个账号创建独立 AccountSession，所有调用明确携带账号上下文 |
| 每账号 iframe 包装 localStorage/sessionStorage | 去掉 iframe 后原先隔离消失 | 显式 StorageService 命名空间，历史 IndexedDB 单独审计和迁移 |
| ChatUI 独立 IIFE、`window.ChihiroChatUI.mount`、双 Teleport | 自带 Vue/Pinia/内存路由，跨应用 DOM 需要同步 | 提取 AgentSidebar/AgentThread，由同一父上下文直接渲染 |
| Vue/Pinia/Vite/TypeScript/i18n 声明版本不同 | 不能直接拼依赖或强制 dedupe | 用兼容验证选定唯一产品版本，再以 peer dependency 接入模块 |
| Stapxs 全局 CSS、AstrBot Vuetify 和 Dashboard 样式 | 一个文档内会冲突、弹层失去主题 | 统一 tokens、弹层层级；旧样式限定模块范围；去掉重复 reset |
| Electron/Tauri/Capacitor 与 NapCat build 条件散布于 IM | 直接引入会把不必要依赖带进 Web 构建 | 宿主能力接口 + Web 实现，保留现有桌面壳路线 |
| 两套前端和壳各有 PWA/缓存逻辑 | 可能互相注销 SW 或清缓存 | 产品只保留一套 PWA 管理和更新机制 |

依赖声明参考：Stapxs 为 Vue ^3.4.30、Pinia ^3.0.3、Vite ^5.3.1、TS ^5.5.2；AstrBot Dashboard 为 Vue 3.3.4、Pinia 2.1.6、Vuetify 3.7.11、Vite ^6.4.1、TS ^5.1.6。AstrBot 同时包含自定义 i18n composables，不能只看 vue-i18n 版本就认定其翻译系统已兼容。

## 3. 目标目录与代码所有权

```text
frontend/                      唯一产品前端工程
  src/
    app/                       bootstrap、providers、AppShell
    router/                    统一路由
    stores/                    产品及账号状态
    api/                       后端 clients 与生成的协议类型
    components/                通用控件、布局和弹层
    modules/
      im/                      Stapxs 派生的千寻 IM
      agent/                   AstrBot ChatUI 派生的 Agent 工作台
      assistant/               会话辅助与托管
    features/                  后续客户、营销任务、报告等业务能力
    styles/                    tokens、主题、全局基础规则
    i18n/                      统一语言服务与适配
  public/
  vite.config.ts
  package.json
backend/                       产品后端工程，继续 Node/TypeScript
  src/
    gateway/                   静态服务、路由、鉴权与连接代理
    runtime/                   账号和服务生命周期
    core/                      客户、任务、策略、发送记录（分阶段新增）
    connectors/                QQ/NapCat 等通道
  integrations/astrbot/         千寻 AstrBot 插件与桥接
  contracts/                   API/事件 schema 真相，供前端生成类型
  migrations/
  tests/
  package.json
deploy/                        镜像组合、配置、数据卷、升级与运维
  docker-compose.yml
  docker-compose.dev.yml
  docker-compose.external-napcat.yml
  astrbot.Dockerfile
  .env.example
  config.example.yaml
  scripts/
  README.md
vendor/                        上游来源；不是另一套产品前端
  stapxs/
  astrbot/
  napcat/
Dockerfile                     产品镜像：构建 frontend + 打包 Node backend
.dockerignore
Makefile                       统一 build/test/image/up 操作入口
```

参考 BOFT-EE 的功能模块组织，采用一个 frontend/package.json，暂不建立内部 UI workspace 包。目录为目标结构，不要求先创建空模块；独立包只有在出现真实复用或独立发布需求时再提取。

**源码迁移策略：**

- 产品自有逻辑位于 `frontend/src`。复用 IM/ChatUI 源码在 `frontend/src/modules/im`、`frontend/src/modules/agent` 中建立可追踪的源码派生模块；不搬入上游整棵启动和构建工程。
- 首次迁移以现有 User* 定制版本为基线，连同真正需要的组件、composables、资源与依赖闭包提取。禁止重新从上游最新版覆盖当前定制成果。
- 前端 shell 只依赖模块公开入口；迁移期模块内部可暂时引用 vendor 的明确依赖清单。最终产品前端依赖闭包不再引用 vendor 的启动入口或未经登记的内部路径。
- 每个派生模块保存 UPSTREAM 信息（上游 repo/commit/path 映射）、迁移时本地差异记录、许可证与必要声明、同步说明。同步使用 Git 三方差异与人工复核，不使用构建时字符串替换。
- 一个功能只能有一个产品源码真相。切换后 vendor 中旧 User* 作为历史兼容来源停止接收产品功能；依赖确认清除后再移除废弃定制入口。AstrBot Python 后端仍留在子模块中。
- 原 AGENTS.md 的“IM 真相在 vendor/stapxs”“ChatUI 在 vendor/astrbot User*”属于现行架构。实施 PR-01 先按用户确认的新方向更新代码所有权规则、迭代文档、上游同步契约和 `check-layout`，然后迁移。本文不修改现行规则或源码。

## 4. 技术栈与构建

继续使用 Vue 3 + TypeScript + Vite + Pinia + Vue Router 4，避免更换框架造成重复实现。首选在兼容原型通过后锁定 Vue 3.5 系列、Pinia 3 和双方可用的 Vite 版本；具体 patch 及 Node 版本以测试矩阵确定，不宣称现有插件已兼容。

产品根采用 npm workspaces，仅纳入 `frontend` 和产品 Node `backend`，延续现有根 npm 工作流；产品模块统一使用根锁文件。参考仓库的 yarn/npm 锁文件可以保留用于上游独立调试，但不参与产品依赖解析。不要直接把两个 vendor 根 package.json 作为产品 workspace：其中包含桌面构建、嵌套 workspace 和产品未使用的依赖。

Vue、Pinia、Vue Router、公共组件运行时由根应用提供；IM、Agent、助手先作为源码模块共享 frontend 的依赖，不自行创建应用实例；未来若提取可复用包，再使用 peerDependencies 约束公共运行时。Vite alias 与 dedupe 是防线，不能替代兼容验证；用模块图和运行时测试核实 Vue 及状态容器只有一份。

目标命令（实施时新增或重定义）：

```sh
npm ci
npm run dev                    # 一键启动前端开发服务 + Gateway
npm run build:web              # 一次生成完整前端
npm run typecheck:web
npm run test:web
npm run test:e2e:web
npm run check:layout
```

开发浏览器仍访问 Gateway 的 `:3100`，Gateway 将前端资源与 HMR WebSocket 转发给 Vite；API/OneBot/AstrBot 路径优先路由，不走 Vite 的 HTML fallback。开发统一入口与生产入口可由不同服务实现，但浏览器访问契约保持一致。生产参考 BOFT-EE 的交付方式：根 Dockerfile 多阶段构建，将 `frontend/dist` 放入产品 Node 镜像的 `/app/public`，由 backend Gateway 同时提供静态页面与 API；history fallback 只用于产品页面请求，缺失脚本明确 404。浏览器只访问这一个产品入口，不能直连内部 AstrBot/NapCat 服务。

Agent 消息渲染、Markdown/代码高亮/公式、文件预览按需加载。公共依赖拆共享 chunk；首次 IM 使用不下载完整 Dashboard、Monaco 或 Agent 专用大型渲染依赖。开发构建覆盖字体、表情、图片、worker 和动态 import，不能只验证首页 JS。

## 5. 统一布局、路由与交互

```text
AppShell
├── AccountRail                账号切换、添加账号
├── WorkbenchLayout
│   ├── ListPane
│   │   ├── ListHeader         搜索 + 消息 / 联系人 / 工作台
│   │   └── MessageList | ContactList | AgentSidebar
│   └── ContentPane
│       └── CustomerConversation | ContactDetail | AgentThread | BusinessPage
└── OverlayHost                弹窗、菜单、预览、通知
```

布局由 CSS Grid/Flex 管理，列表宽度、拖动调整与窄屏导航属于 AppShell；模块不自行固定全屏、不通过 left 像素覆盖另一个应用。AgentSidebar 与 AgentThread 在同一个 AgentWorkspaceProvider 下读取一个会话上下文，直接放入父布局 slot。弹窗可以使用 Vue Teleport，但不再靠跨应用 Teleport 分配主页面。

建议路由：

- `/w/:workspaceId/accounts/:accountId/messages/:conversationId?`
- `/w/:workspaceId/accounts/:accountId/contacts/:contactId?`
- `/w/:workspaceId/agent/:agentSessionId?`
- `/w/:workspaceId/tasks/:taskId?`、`leads`、`reports`（业务阶段逐步实现）
- `/settings/...`

账号 ID 采用完整编码后的稳定 ID。页面进入时验证实体、权限和账号归属；地址中没有 token。旧产品链接可映射时跳转，不可映射时回到选择页并说明原因。

工作台 Agent 默认属于工作空间。当前选中账号可作为建议上下文，但不会暗中改变已创建任务的执行账号；Agent 顶部显示任务作用账号/会话，允许明确修改。首次迁移保留当前服务支持的单工作空间，不用前端字段假装已经有服务端租户隔离。

搜索随标签改变范围：消息搜消息，联系人搜联系人，工作台搜 Agent 会话/项目；跨群业务检索作为明确入口。联系人详情可跳转客户聊天，消息可引用到助手，任务/报告可跳转源会话。

## 6. 多账号模型：移除 iframe 的前置条件

根 Pinia 只创建一次，但状态按工作空间和账号索引，不能把“一个 store”理解为“只有一份当前账号消息”。建议：

```text
accountsStore                 账号列表、登录状态
navigationStore               当前视图和路由上下文
imStore.byAccount[accountId]   联系人、未读、会话索引
messagesStore[conversationKey] 消息分页和加载状态
composerStore[conversationKey] 草稿、附件、引用、发送状态
agentStore[agentSessionId]     Agent 对话、项目、运行状态
assistantStore[conversationKey]模式、候选、内部指示和 runId
```

`conversationKey` 至少包含 workspaceId、channelAccountId、会话类型和 peerId。平台 ID 使用字符串；同一个 QQ 用户在不同账号下的客户会话不可直接混为一份。

`AccountSessionManager` 持有 `Map<accountId, AccountSession>`；每个 session 拥有连接、重连计时器、请求 echo 映射、订阅和取消资源。`activeAccountId` 仅控制显示，不决定异步请求最终归属。

关键实现：

1. 移除 Stapxs `connect.ts` 模块级 websocket/login/retry 单例；改为 `createAccountSession(context)` 与实例方法。
2. 账号上下文必须进入消息分发、历史查询、发信、附件上传、通知和缓存接口，不能只改最外层 store。
3. 发信动作在创建时捕获明确账号和会话。A 的发信请求进行中切到 B，不得改发到 B。
4. A 的历史请求完成时只更新 A 的缓存；当前组件可取消或忽略已过期的显示请求。
5. 后台账号可继续收事件/更新未读，界面只挂当前视图。不要用 N 个 KeepAlive 隐藏整套 IM 来继续模拟 iframe。
6. 对话草稿保存在按会话索引的 store/本地持久化中，组件销毁后仍可恢复。KeepAlive 仅是优化，有容量上限且不保证后台任务存活。
7. 移除账号时精确释放其连接、临时 URL、任务订阅和相关缓存，保留其他账号及工作空间 Agent 状态。

更长期可由 Runtime/core 统一采集，再向前端推标准化事件；这一后台改造不是本次单前端切换的前提。过渡期每个 AccountSession 仍可通过 Gateway 连接该账号 OneBot。

## 7. 存储与既有数据迁移

- 不再覆盖 `window.localStorage`、`sessionStorage` 或修改内建存储对象。提供 `settingsStorage`、`accountStorage(accountId)`、`draftStorage(conversationKey)`。
- 清点原 `chihiro:<instanceId>:` 前缀、非前缀 AstrBot 设置、IndexedDB 名称与键、背景资源和历史消息；存储是否按账号隔离必须逐项验证，不能假设 iframe 隔离了同源 IndexedDB。
- 建立版本化迁移：旧 instanceId 通过 Runtime 账号记录映射 accountId → 复制可确认归属的设置/草稿 → 校验 → 标记迁移完成。归属不明确的数据保留并提示选择，不猜测合并。
- 首期迁移非破坏性且可重复运行；不删除旧库、不清全站缓存。旧版回退使用原有数据；新版新增草稿保留并支持恢复或导出，回退不会假装旧版能读取新格式。
- 平台 token 不进入产品路由/日志或普通偏好存储；统一走现有 Gateway 服务端凭据处理，IM WebSocket 鉴权方式在通道接口中落实。
- 本地消息缓存不替代后端业务数据库；数据失效、撤回、引用和多窗口协调按来源处理。

## 8. API、服务与模块契约

由根应用构造 `AppServices`，通过注入交给模块：

- `RuntimeClient`：账号登录/退出、运行状态、按需启动。
- `ImClient.forAccount(accountId)`：联系人、群、历史、消息及附件能力。
- `AgentClient`：AstrBot 会话/项目/模型/流式生成。
- `AssistantClient`：会话策略、问助手、候选、审批、接管（可先适配现有后端）。
- `StorageService / NotificationService / DialogService / HostCapabilities`。

不同后端独立 axios/fetch client，不修改默认 axios 或全局 fetch；不得从默认 `localStorage.token` 自动猜测身份。401/断线只影响对应后端状态，不清除整个产品登录或跳到 AstrBot 登录页。

内部普通组件用 props/emits；跨模块共享业务状态放领域 store；跨后台运行用类型化事件。移除 IM/壳/ChatUI 的内部 postMessage；桌面宿主或外部高级管理页面的真实边界通信仍通过窄接口保留。

事件至少包含 accountId/conversationId 或 agentSessionId、runId 和版本字段；建立明确的订阅释放、重连、重复事件处理与快照恢复。前端不能单凭生成完成把回复标为“已发送”，UI 消费后端实际状态。

客服业务执行器与真实回执迁移属于 `ai-im-roadmap.md` 的基础阶段。统一前端可以先适配旧 API，但在后端完成前不得将它宣传为可靠的自动营销执行平台。

## 9. ChatUI 与 IM 的提取方式

### IM 模块

提取 UserMessages、UserFriends、UserChat/UserComposer、消息体、历史窗口、表情、附件预览及其确需依赖。原 App.vue 中账号登录、顶层导航、全局弹窗、设置、全局事件迁移到 shell 或服务。

消除业务代码 `import app/i18n from main`：翻译和应用服务改从独立 provider/composable 获取。可暂时保留 `@renderer` 兼容别名帮助迁移，但公开依赖只能是模块入口；最终没有通过 alias 启动上游应用的隐式副作用。

### Agent 模块

以当前 AstrBot UserChat 和既有定制为起点，拆出：

- AgentWorkspaceProvider / useAgentWorkspace：会话选择、项目、消息、流状态、模型选择。
- AgentSidebar：项目、会话、创建/编辑/删除入口。
- AgentHeader：模型和项目上下文。
- AgentThread：消息、原生输入、多媒体、线程、推理摘要/引用/工作区文件。

保留原生成、消息渲染、工具展示和输入能力；通过组件职责拆分降低大文件耦合，不另写一套简化 ChatUI 替代。

模块不创建内存路由、不执行 `setupHttpClient()` 全局补丁、不改 document/body；路由由父应用映射，模块使用明确的导航接口。删除产品使用路径上的动态 script/link 注入、`__CHIHIRO_CHATUI_HOSTED__` 环境猜测和 `window.ChihiroChatUI`。

### 会话助手模块

机器人图标仍在 IM 输入框右上角；展开 AssistantPanel 后保留 IM 编辑能力。明确“发给客户”与“问助手”两种动作。模式为人工/辅助/审核/自动，展示运行步骤、依据、候选、编辑和人工接管。

AI 内部沟通存 assistantStore，客户原始消息存 messagesStore。工作台 Agent 可接收当前会话引用，也可创建跨会话任务，但不通过复制全部 IM store 到 Agent store 实现共享。

## 10. UI 基础、样式、语言和宿主能力

- 定义产品 tokens：背景/表面/文字/边框/强调色、字号、间距、圆角、列表宽度、层级。根主题服务负责 light/dark/system；模块只消费。
- Vuetify 保留用于 AstrBot 原生组件及适合的新业务表单，作为同一 Vue 应用的一次插件注册。逐个验证注册方式和 reset 影响；不立即重写全部 Stapxs 控件。
- 公共控件通过 `@/components/common` 提供稳定接口。旧 BCUI/Stapxs 样式置于 `.im-module`；AstrBot 专用规则置于 `.agent-module`。唯一全局 reset 和根布局由产品拥有，不导入整份 Dashboard layout stylesheet。
- scoped CSS 不能隔离所有全局规则；对 html/body/:root、元素选择器、同名动画、字体与第三方 CSS 做实际审计。迁移期可以采用构建级选择器限定，但不用运行时改样式字符串。
- 普通弹窗、菜单、预览和通知挂到唯一 OverlayHost。内容携带来源模块的主题/排版上下文和必要作用域类，验证 focus trap、Esc、定位、遮罩、滚动锁，不能只在面板内看起来正常。
- 语言由一个 locale 服务管理；旧 Stapxs 中文键与 AstrBot 点路径键通过命名空间和兼容适配器保留。日期、数字、后端 Accept-Language 同步。分模块翻译资源懒加载，不强行把所有旧键一次改名。
- 宿主能力包括剪贴板、选择文件、保存下载、通知、打开链接；Web/PWA 先实现，现有桌面壳适配。Electron/Tauri/Capacitor 专有 API 不进入通用模块依赖闭包。本次不同时更换桌面容器。
- 表情、字体、业务必需脚本产品本地提供；可选网络资源失败不阻塞初始化。图片等消息内容按渠道支持加载，不做全量下载。

## 11. 设置与 Dashboard 的范围

千寻常用设置统一纳入 `/settings`：账号状态、外观、模型/供应商、知识库入口、助手角色、会话策略。模型等继续通过 AstrBot API 读写，不能前端保存一套脱节配置。

完整 AstrBot Dashboard/NapCat WebUI 先保留为高级维护入口，可在单独页面打开，并明确属于外部管理工具；核心消息、Agent、托管流程不依赖它们。完整管理后台的所有页面是否最终产品化，应按业务需要逐页决定，不自动成为 IM/ChatUI 统一的前置范围。

## 12. 分阶段交付与依赖

| 阶段 / 建议 PR | 主要改动 | 验收与完成门槛 |
|---|---|---|
| U0 / PR-01：边界和基线 | 固定现有代码/依赖基线，能力清单，源码来源，更新工程所有权与检查规则 | 各既有修改有归属；IM/ChatUI 必保功能及已知缺陷登记；单应用兼容验证范围明确 |
| U1 / PR-02：根工程 | `frontend` Vue/Vite、workspaces、contracts/services、router/tokens/overlay、开发网关/HMR | 干净安装可构建；壳登录和账号栏可运行；不启动额外 Vue；旧版本仍可回退 |
| U2a / PR-03：IM 去全局化 | AccountSession、按账号 stores、存储适配、宿主接口、移除 main 反向依赖 | A/B 账号状态和连接独立；异步切换测试无串写；兼容原型证明主要组件可导入 |
| U2b / PR-04：IM 页面迁移 | 提取产品 IM 模块、接父布局、资源/历史/编辑器/设置迁移 | 单应用完成收发与历史；所有必保消息类型和附件流程验收；旧 IM iframe 不在新路径中 |
| U3 / PR-05：ChatUI 模块迁移 | 提取组件与依赖闭包，接统一 store/router/services，移除独立挂载 | 工作台侧栏与右侧 AgentThread 普通组件联动；流式/项目/模型/附件/弹窗与原功能对照通过 |
| U4 / PR-06：会话助手与体验统一 | AssistantPanel、上下文引用、明确发送目标、主题/语言/通知、常用设置 | 客户会话与助手内聊分开；草稿保留；快速切账号和标签不改变发送对象 |
| U5 / PR-07：默认切换与退役 | 完整构建发布、旧路由迁移、PWA/缓存升级、删除产品旧挂载链和死代码 | 正式入口只有一个应用/构建；端到端回归通过；回退演练成功；文档与 CI 按新架构运行 |

依赖：U0 → U1 → U2a → U2b → U3 → U4 → U5。U3 的源码依赖审计可以在 U2 时开展，但正式整合必须基于已确定的公共运行时契约。

U0 包含小型兼容原型：IM 消息列表/编辑器与 Agent 输入/菜单在一个 Vue 应用中工作，验证依赖版本、CSS、翻译、Pinia 注入。它决定版本与必要改造，不等于先把两个完整应用硬塞进 shell。

每个 PR 是可审查交付边界，遇到较大 U2/U3 按“服务抽取 → 组件迁移 → 验证”再拆；不以 PR 数量承诺工期。U0 完成后按全局依赖和资源清单估算实际工作量。

## 13. 渐进切换、回退与旧入口退役

- 实施期间先把统一前端放在受控预览入口（例如 `/next/`），旧根入口可用。预览构建的 base 和路由匹配；不注册能控制整个站点的新 SW。
- 同一账号测试时，旧和新界面不得同时驱动自动托管或重复业务动作。先用 mock/测试账号验证并发，再按明确账号进入实测。
- U5 切换 Compose 产品入口到新的 chihiro 镜像，由 Node Gateway 提供统一前端静态产物与 API；保留上一版完整镜像组合作为短期回退，不永久维护两个活跃产品前端。
- 旧 HTML 禁止长期缓存，带 hash 资源可缓存；发布切换需暂存前一版 hash 资源或原子部署，避免运行中页面 lazy import 旧 chunk 得到 404。新 SW 更新提示保存草稿，不强制刷新正在编辑页面。
- API、QQ WebSocket、Agent SSE/WS、含身份的资源和大附件不做通用 PWA 离线缓存。
- 旧 `/i/:instance/...` 后端代理路径按依赖保留；被移除的是产品 UI 的插件依赖，不应顺带删掉仍供协议或高级维护使用的后端路径。
- 退役产品 `AgentChatHost` 动态加载入口、ChatUI IIFE 构建、账号 iframe 管理、内部 postMessage 协议、重复 PWA 初始化及挂载 CSS。
- `rebuild:im` 不再是产品前端必需命令；`rebuild:astrbot-ui` 只用于维护完整高级 Dashboard。是否移除 NapCat 插件构建/安装脚本须先确认其没有承担仍需的后端扩展功能。
- 最后统一更新 README、AGENTS、产品/迭代/启动/同步文档、检查脚本和 CI；旧架构文档标记为历史，避免相互矛盾。

## 14. 测试与验收清单

**工程与边界：**一次干净安装/构建；只有一个产品 createApp/根 Pinia/router；前端不引用 vendor 启动文件；核心链路不创建 iframe 或加载 ChatUI IIFE；浏览器模块不引入 Node/桌面专属代码；模块图无重复 Vue。

**多账号（最高优先级）：**两个账号拥有相同 peerId；A 请求未返回切 B；A 待发草稿时切 B；后台账号新消息；一个账号重连/移除；上传过程中切换；未读数、历史、附件、引用和发送回执均归原账号。测试需验证最终请求目标，不能只看屏幕名字。

**IM 功能：**文字/表情/图片/文件/语音/视频/引用/转发/撤回等支持清单，分页历史、搜索、编辑草稿、剪贴板、拖放上传、预览与下载；按当前实际功能逐项比对，不能默认框架迁移会自动保留。

**Agent 功能：**项目/会话增删改、模型选择、流式响应与停止、代码/公式/工具结果、多模态、线程与文件面板；会话选择后两栏同步，离开再返回草稿和运行状态正确，断线可恢复或明确提示。

**会话助手：**问助手不会直接成为客户消息；模式切换、内部指示、候选编辑与审批、人工接管；发送中断和新消息导致草稿过期状态正确。后端未提供的能力以明确禁用/兼容状态展示，不伪造成功。

**UI 与可用性：**深浅/系统主题、字体、紧凑列表、宽度拖动、窄窗口、弹层定位与层级、键盘导航、Esc、焦点恢复；平台必要权限提示可理解。

**数据与部署：**旧设置/草稿迁移可重复、未知归属数据保留；刷新深链接、旧链接跳转、离线、SW 升级、构建切换与回退；没有清除其他账号数据。

**性能与生命周期：**采集旧版基线，比较首屏/切换/首 token 前端延迟和内存；设置路由 chunk 预算；多次切换/登录退出后订阅数和连接数回到预期。首屏不下载完整 Agent/管理后台，运行历史按分页加载。具体阈值在 U0 基线上确定并进入 CI，不能只依赖构建体积警告。

工具选择：Vitest 用于上下文、路由、迁移和状态逻辑；Vue Test Utils 用于关键组件；Playwright 用于整页、多账号与发布场景；API/WS/SSE 使用可控模拟验证时序，再用有限真实账号验收。测试发送使用专用测试会话和明确授权，不向真实客户发测试内容。

## 15. 统一完成后与业务路线的衔接

统一前端优先交付现有 IM、ChatUI 和助手交互的可靠整合，不在同次迁移中重写整个 CRM/营销后端。`backend/contracts` 和 `frontend/src/api` 为后续业务核心预留接口；线索、活动、报告成为 `frontend/src/features` 中的普通业务视图。

前端统一完工的标志是：开发者在一个工程完成修改、调试、测试和发布；用户在一个应用内切客户会话、询问 Agent、采用回复建议；核心流程不再经过两个前端应用之间的同步协议。
