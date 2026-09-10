# 千寻给 Agent 的手

不用配 MCP JSON。工作台开着时，把这段交给任意能发 HTTP 的 Agent：

**链接：** http://127.0.0.1:3100/mcp

或直接粘贴：

```
# 千寻 QQ 手

本机工作台已打开：http://127.0.0.1:3100
用 HTTP 操作，不要编造账号或对方 QQ 号。发送、批准草稿前先问我。不要加好友。不要自行生成并乱发图片。

## 看 observe
GET http://127.0.0.1:3100/api/runtime/agent/observe?kind=KIND
KIND：accounts | sessions | session | messages | drafts | friends | groups | members

- accounts 不必带账号
- 其余加 &accountId=qq:QQ号
- **session / messages**：看某个私聊或群里实际聊了什么（直接桥接 QQ 历史）
  - 必加 &peerId=对方QQ或群号&type=private|group
  - 可选 &count=30（默认 30，最大 100）
  - session 带元数据 + messages（QQ 正文）+ agentMessages
  - messages 只返回聊天正文
- members 再加 &groupId=群号

## 发 send
POST http://127.0.0.1:3100/api/runtime/agent/send
Content-Type: application/json

{"accountId":"qq:我的QQ","peerId":"对方QQ","type":"private","text":"正文"}
群聊 type 用 group。可选 "image": "本地路径或URL"（图由你自己生成）。

## 闸门
改权限：POST /api/runtime/agent/mode
{"accountId":"qq:我的QQ","mode":"ask"}
mode：ask / auto / always。可再加 peerId、type。

批准：POST /api/runtime/agent/draft/approve  {"id":"草稿id"}
丢弃：POST /api/runtime/agent/draft/discard  {"id":"草稿id"}
```

## 试用

先重启网关，登录 QQ，再把上面整段（或链接里的全文）丢给 Agent。

摸手：只 observe accounts、groups、friends，不要发消息，中文汇报几个号/群/好友。

读群：observe kind=session（或 messages）+ peerId=群号 + type=group，用返回的 messages 汇报最近聊了什么。

入站：observe drafts，有草稿先念给我，等我点头再 approve。

群画像：observe groups → members，列出 5 个值得加好友的人（user_id + 理由）。不要 send、不要加好友。

逐个私聊：先把原文给我看，确认后再一条一条 send，间隔约 8 秒。

stdio MCP（`npm run mcp`）仍可用，不是默认用法。
