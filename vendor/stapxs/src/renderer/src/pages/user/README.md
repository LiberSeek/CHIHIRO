# Chihiro User UI

千寻维护的 IM 界面。原版 `pages/Chat.vue`、`Messages.vue` 等保留给上游合并，日常改这里。

| 文件 | 对应上游 |
|---|---|
| `UserChat.vue` | `pages/Chat.vue` |
| `UserMessages.vue` | `pages/Messages.vue` |
| `UserFriends.vue` | `pages/Friends.vue` |
| `UserInfo.vue` | `pages/Info.vue` |
| `UserOptions.vue` | `pages/Options.vue` |
| `UserQzone.vue` | `pages/Qzone.vue` |
| `components/user/UserMsgBody.vue` | `components/MsgBody.vue` |
| `components/user/UserFacePan.vue` | `components/FacePan.vue` |
| `components/user/UserFriendBody.vue` | `components/FriendBody.vue` |
| `components/user/UserNoticeBody.vue` | `components/NoticeBody.vue` |
| `components/user/UserMergePan.vue` | `components/MergePan.vue` |

默认 `chatview_name` 为 `UserChat`。样式在 `assets/css/user.css`。

**不要改上游文件**（`pages/Chat.vue`、`Messages.vue`、`components/MsgBody.vue`、`FacePan.vue`、`chat.css`、`view.css`）。产品 UI 只动 `User*` 和 `user.css`，避免和 Stapxs `next` 冲突。
