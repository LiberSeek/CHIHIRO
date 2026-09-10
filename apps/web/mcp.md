# 千寻 QQ 手

本机工作台已打开：http://127.0.0.1:3100
用 HTTP 操作，不要编造账号或对方 QQ 号。发送、批准草稿前先问我。不要加好友。不要自行生成并乱发图片。

## 看 observe
GET http://127.0.0.1:3100/api/runtime/agent/observe?kind=KIND
KIND：accounts | sessions | session | messages | drafts | friends | groups | members

- accounts 不必带账号
- 其余加 &accountId=qq:QQ号
- **session / messages**：看某个私聊或群里实际聊了什么（直接桥接 QQ 历史，不依赖 Agent 是否追踪过）
  - 必加 `&peerId=对方QQ或群号&type=private|group`
  - 可选 `&count=30`（默认 30，最大 100）
  - `session` 返回元数据 + `messages`（QQ 正文）+ `agentMessages`（Agent 流水）
  - `messages` 只返回精简聊天正文列表
- members 再加 &groupId=群号

## 发 send
POST http://127.0.0.1:3100/api/runtime/agent/send
Content-Type: application/json

{"accountId":"qq:我的QQ","peerId":"对方QQ","type":"private","text":"正文"}
群聊 type 用 group。可选 "image": "本地路径或URL"（图由你自己生成）。

## 闸门 gate
改权限：
POST http://127.0.0.1:3100/api/runtime/agent/mode
{"accountId":"qq:我的QQ","mode":"ask"}
mode：ask=每条先问我，auto=只拦链接/图片/@全体，always=直接发。可再加 peerId、type 只改一个会话。

批准草稿：
POST http://127.0.0.1:3100/api/runtime/agent/draft/approve
{"id":"草稿id"}

丢弃草稿：
POST http://127.0.0.1:3100/api/runtime/agent/draft/discard
{"id":"草稿id"}
