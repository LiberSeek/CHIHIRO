# Chihiro MCP

给外部 Codex / Claude CLI 用的控制面。千寻工作台需已在 `http://127.0.0.1:3100` 运行。

```json
{
  "mcpServers": {
    "chihiro": {
      "command": "node",
      "args": ["/ABS/CHIHIRO-EE/apps/mcp/server.mjs"]
    }
  }
}
```

可选环境变量 `CHIHIRO_URL`（默认 `http://127.0.0.1:3100`）。

| 工具 | 作用 |
|---|---|
| `list_accounts` | QQ 账号、是否在线、Bot 是否接管 |
| `list_sessions` | 该账号 Bot 处理过的全部会话 |
| `get_session` | 会话消息与待确认拟稿 |
| `set_mode` | `ask` / `auto` / `always`（可按会话） |
| `list_drafts` | 待你确认的出站回复 |
| `approve_draft` / `discard_draft` | 发送或丢弃拟稿 |
| `ask_bot` | 操作员指示，不发给对方 QQ |
| `send_to_peer` | 以当前账号发给对方 |

出站闸门在千寻，不在 MCP。`ask` 模式下 Bot 回复会挂起，需 `approve_draft` 或工作台点「发送」。
