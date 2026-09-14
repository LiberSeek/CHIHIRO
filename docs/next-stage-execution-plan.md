# 千寻下一阶段执行计划

状态：进行中。基线 tag：`0.0.2`。当前目标版本：`0.1.0 基础可用版`。

## 目标

把千寻从“统一前端可用原型”推进到“可日常使用的 AI IM 工作台底座”。本阶段不把营销获客、群发、画像、报告作为主交付；这些能力依赖稳定的多账号、IM、Agent 和发送出口。

## 开发顺序

```text
阶段 A：回归验收与问题清单冻结
  ↓
阶段 B：多账号 / IM 状态稳定性
  ↓
阶段 C：IM 与 Stapxs 定制版 parity
  ↓
阶段 D：Agent ChatUI 原生模块化收尾
```

阶段之间允许审计并行，但合入顺序以 B → C → D 为主，避免视觉 parity 或 Agent 拆分覆盖多账号状态保护。

## 分工

| 阶段 | 执行方式 | 模型 | 工作区 | 交付 |
|---|---|---|---|---|
| A / B 主线 | 主 agent | 当前会话 | 主 worktree `develop` | 验收清单、状态归属修复、测试 |
| C IM parity | subagent `stage_c_im_parity` | `gpt-5.6-terra` | `../.codex-worktrees/chihiro-stage-c-im-parity` | parity 审计、小步修复、测试、本地提交 |
| D Agent native | subagent `stage_d_agent_native` | `gpt-5.6-sol` | `../.codex-worktrees/chihiro-stage-d-agent-native` | 原生化依赖审计、小步修复、测试、本地提交 |

## 阶段 A 当前状态

已完成：

- `0.0.2` tag 固定在 `217e9e1`。
- 新增 `docs/0.1.0-acceptance.md`，冻结 0.1.0 验收边界。
- 关键前端检查通过：typecheck、关键状态测试、frontend build。

继续补充：

- 子任务审计结果回收后，把剩余问题按 P0/P1/P2 写回验收清单。
- 每次合入子任务前重新跑相关测试。

## 阶段 B 当前任务

优先级最高的问题是“上下文归属”：账号、会话、未读、草稿、附件、异步请求结果必须归属于发起时的账号/会话。

已完成：

- IM workspace 异步归属已有测试覆盖。
- AccountSessionManager 已按账号隔离连接、请求和订阅。
- 未读写回只在 native 账号确认连接完成后归属当前账号，避免账号切换过程把旧 contacts store 的未读写到新账号。

待继续：

- 增加 WorkspaceModule 可测试 seam，把路由恢复、联系人详情、未读归属从大组件中继续抽出纯逻辑。
- 验证 route `/im?chat=...` 在账号切换后不会错误恢复旧账号会话。
- 检查上传、图片预览、转发弹窗是否随账号切换清理。

## 阶段 C 预期检查点

- 图片预览头像、右侧边距、关闭行为。
- 转发窗口样式和目标选择行为。
- 输入框无文字时二次返回行为。
- 表情弹窗、会话信息栏、IM 控件背景不透明。
- 联系人单击详情、双击打开会话。
- toast 上方居中。
- 顶部高度统一。

## 阶段 D 预期检查点

- Agent 主路径不依赖完整 AstrBot Dashboard router/auth/layout。
- `window.ChihiroChatUI`、动态 IIFE、memory router、全局 fetch/axios patch 从产品路径退役或有明确隔离计划。
- `AgentSidebar`、`AgentThread`、`AgentHeader`、`useAgentWorkspace` 的职责边界清楚。
- AstrBot Dashboard 只保留高级设置入口。

## 合入门槛

每个子任务合入主线前至少满足：

- 工作树干净，有本地提交。
- 报告包含改动文件、提交 hash、验证命令、剩余风险。
- 与主线无冲突或冲突可解释。
- 相关测试通过；如果只做审计文档，也要通过 `git diff --check`。

