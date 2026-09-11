# Chihiro User UI

千寻维护的 IM 界面。原版 `pages/Chat.vue`、`Messages.vue`、`components/MsgBody.vue` 等保留给上游合并，日常改这里。

默认 `chatview_name` 为 `UserChat`。样式在 `assets/css/user.css`。

**不要改上游文件**（`pages/Chat.vue`、`Messages.vue`、`components/MsgBody.vue`、`FacePan.vue`、`chat.css`、`view.css`）。产品 UI 只动 `User*` 和 `user.css`，避免和 Stapxs `next` 冲突。

## 页面

| 文件 | 对应上游 |
|---|---|
| `UserChat.vue` | `pages/Chat.vue` |
| `UserMessages.vue` | `pages/Messages.vue` |
| `UserFriends.vue` | `pages/Friends.vue` |
| `UserInfo.vue` | `pages/Info.vue` |
| `UserOptions.vue` | `pages/Options.vue` |
| `UserQzone.vue` | `pages/Qzone.vue` |
| `UserSystemNotice.vue` | `pages/chat-view/SystemNotice.vue` |
| `UserOptAccount.vue` | `pages/options/OptAccount.vue` |
| `UserOptView.vue` | `pages/options/OptView.vue` |
| `UserOptFunction.vue` | `pages/options/OptFunction.vue` |
| `UserOptAddon.vue` | `pages/options/OptAddon.vue` |
| `UserOptDev.vue` | `pages/options/OptDev.vue` |
| `UserOptInfo.vue` | `pages/options/OptInfo.vue` |

## 组件 `components/user/`

| 文件 | 对应上游 |
|---|---|
| `UserMsgBody.vue` | `components/MsgBody.vue` |
| `UserFacePan.vue` | `components/FacePan.vue` |
| `UserFriendBody.vue` | `components/FriendBody.vue` |
| `UserNoticeBody.vue` | `components/NoticeBody.vue` |
| `UserMergePan.vue` | `components/MergePan.vue` |
| `UserEmojiFace.vue` | `components/EmojiFace.vue` |
| `UserFileManager.vue` | `components/FileManager.vue` |
| `UserMusicPlayer.vue` | `components/MusicPlayer.vue` |
| `UserGlobalSessionSearchBar.vue` | `components/GlobalSessionSearchBar.vue` |
| `UserViewerCom.vue` | `components/ViewerCom.vue` |
| `UserHistory.vue` | `components/History.vue` |
| `UserBulletinBody.vue` | `components/BulletinBody.vue` |
| `UserFileBody.vue` | `components/FileBody.vue` |
| `UserAboutPan.vue` | `components/AboutPan.vue` |
| `UserQzonePermissionPan.vue` | `components/QzonePermissionPan.vue` |
| `UserTinySessionBody.vue` | `components/TinySessionBody.vue` |
| `UserLazyLottie.vue` | `components/LazyLottie.vue` |
| `UserVoiceMsg.vue` | `components/VoiceMsg.vue` |
| `UserUpdatePan.vue` | `components/UpdatePan.vue` |
| `UserWelPan.vue` | `components/WelPan.vue` |
| `UserRawMsgRenderPreviewPan.vue` | `components/RawMsgRenderPreviewPan.vue` |
| `UserThemeColorPickerPan.vue` | `components/ThemeColorPickerPan.vue` |
| `UserUmamiInfoPan.vue` | `components/UmamiInfoPan.vue` |
| `UserDepPan.vue` | `components/DepPan.vue` |
| `UserJsonSegComp.vue` | `components/msg-component/JsonSegComp.vue` |
| `UserXmlSegComp.vue` | `components/msg-component/XmlSegComp.vue` |
| `tooltip/UserTooltips.vue` | `components/tooltip/Tooltips.vue` |
| `tooltip/UserTooltip.vue` | `components/tooltip/Tooltip.vue` |
| `tooltip/UserCustomFaceTooltip.vue` | `components/tooltip/CustomFaceTooltip.vue` |
| `tooltip/UserInfoTooltip.vue` | `components/tooltip/UserInfoTooltip.vue` |

`jsonComp/` 与 `notice-component/` 按目录隔离，内部文件名保持上游原名（卡片 app-id glob、公告 `template` 动态 import 依赖文件名）。

`UserFileManager` / `UserMusicPlayer` 带模块级状态。千寻路径（`App.vue`、`UserChat`、`UserMsgBody`、`function/msg.ts`、`jsonComp/Music.lua.vue`）必须只引用这一份，不要和上游原件混用。

未拷贝的可选聊天皮肤：`Chat弹幕` / `Chat终端` / `ChatGlagame`（设置里仍可切到上游 `pages/chat-view/`）。需要定制时再按同样方式 fork。
