# AstrBot ChatUI 在工作台中的集成

## 产品目标

Stapxs 负责整个 IM 布局和导航。工作台标签下，列表栏顶部保留 Stapxs 的搜索与标签切换，下面展示 AstrBot ChatUI 的项目、会话及设置入口；右侧聊天区域展示 AstrBot 原有消息、输入框、模型选择和项目文件。左右共用同一个会话状态。Dashboard 继续作为独立管理页面。

## 实现边界

- `vendor/astrbot/dashboard/src/chihiro/mount.ts` 将 ChatUI 构建为独立浏览器库，拥有自己的 Vue、Pinia、内存路由和 Vuetify。
- `components/user/UserChat.vue` 复用 AstrBot 原生组件与业务逻辑，用两个 Teleport 将侧栏、聊天主体放入 Stapxs 容器。`UserChatHeader.vue` 补齐原 Dashboard 页头提供的原生模型选择与项目文件入口。
- `ChihiroChatUI.vue` 提供主题、提示与确认弹窗。菜单、对话框统一挂在 ChatUI 自有容器中。
- 两个 Vue 应用不共同修改一个 DOM 节点。Stapxs 只拥有外层槽位；ChatUI 创建自己的内层节点并维护主题类。
- 独立库的 CSS 在构建时限定在 ChatUI 作用域内，Standalone Dashboard 的 CSS 不变。
- `AgentChatHost.vue` 首次进入工作台才请求启动 AstrBot，再加载库；显示启动、加载、错误及重试状态。离开工作台隐藏显示区域，不销毁 ChatUI，以保留草稿和当前会话。IM 被销毁时才释放 ChatUI。

## 网关与运行时

- `/astrbot/chihiro/*` 直接读取本地构建产物。缺少资源返回明确的 404，不转发给尚未启动的 Python 服务。
- `/api/runtime/bot/ensure` 按需启动 AstrBot；并发调用共用一次启动过程。
- `/astrbot/api/*` 由网关注入 AstrBot 身份，普通 HTTP、流式响应和 WebSocket 均转发到 AstrBot。ChatUI 不复用或清除 Stapxs/NapCat 的登录令牌，也不覆盖宿主的 `fetch`。
- 浏览器只访问 Gateway；`6185` 是网关后端连接地址。

这不是两份独立的 ChatUI，也不是两个 iframe。构建包来自 AstrBot 子模块，不将上游业务源码复制进 `apps/`。后续同步仍在 AstrBot `develop` 的 `User*` 适配中维护。

## 构建与验证

```sh
npm run rebuild:astrbot-ui
npm run rebuild:im
node --test backend/test/gateway/astrbot-chatui.test.mjs
npm run check:layout
```

网关源码更新后需要重新启动网关进程，再强制刷新工作台。仅更新 ChatUI 前端时，重新构建并刷新即可；静态资源无需依赖 AstrBot 进程重启。

回归检查覆盖：后端未启动时本地文件可访问、缺失资源与路径逃逸处理、POST 流式响应不被提前截断，以及 HTTP/WebSocket 的后端鉴权。浏览器需另外检查：双栏边界、切换标签保留草稿、模型菜单、项目弹窗、历史消息和深浅主题。

首次加载的独立包包含 AstrBot 原生渲染依赖，体积较大，当前采取首次访问加载并在 IM 生命周期内复用。实际模型生成、语音录制和附件上传应结合使用中的模型与权限继续验收。

## 本次验证记录（2026-09-13）

已完成两个前端构建、布局检查和网关回归测试。在真实 Stapxs 工作台与真实 AstrBot 数据上使用独立 Chromium 验证：两栏尺寸、深色主题、启动失败重试、标签切换保留草稿、原生模型菜单、项目创建弹窗及历史会话读取。没有发送聊天消息或提交项目/模型配置。

浏览器测试为保护当前 QQ 运行状态，没有重启旧网关；测试拦截提供新构建文件，并使用新网关模块生成后端鉴权。完整网关路由切换仍需重启进程后验收。另将外部拼音脚本延迟 15 秒，确认 IM 初始化不再等待整个窗口的 load 事件。
