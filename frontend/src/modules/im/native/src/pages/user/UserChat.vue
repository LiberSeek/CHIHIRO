<!--
 * @FileDescription: 聊天面板页面
 * @Author: Stapxs
 * @Date:
 *      2022/08/14
 *      2022/12/12
 * @Version:
 *      1.0 - 初始版本
 *      1.5 - 重构为 ts 版本，代码格式优化
-->

<template>
    <div id="chat-pan"
        v-move="chatMoveOptions"
        :class="'chat-pan user-skin' +
            (profileOnly ? ' contact-profile-view' : '') +
            (uiStore.openSideBar ? ' open' : '') +
            (multipleSelectList.length > 0 ? ' is-multiselect' : '') +
            (['linux', 'win32'].includes(backend.platform ?? '') ? ' withBar' : '')"
        :style="{
            'background-image': toBackgroundImageStyle(!settingsStore.sysConfig.chat_more_blur ? settingsStore.sysConfig.chat_background : ''),
            'background-position': settingsStore.sysConfig.chat_background_align ?? 'center',
            'background-size': settingsStore.sysConfig.chat_background_fit ?? 'cover'
        }"
        @v-move-right.prevent="exitWin()">
        <slot name="chat-extra" />
        <!-- 聊天基本信息 -->
        <div class="info">
            <font-awesome-icon class="back" :icon="['fas', 'angle-left']" @click="exitWin" />
            <img :src="chat.show.avatar">
            <div class="info">
                <p>
                    {{ chat.show.name }}
                    <template
                        v-if="chat.show.type == 'group'">
                        ({{
                            chat.info.group_members.length
                        }})
                    </template>
                </p>
                <span v-if="chat.show.temp">
                    {{ $t('来自群聊：{group}', { group: chat.show.temp }) }}
                </span>
                <span v-else>
                    <template v-if="chat.show.appendInfo">
                        {{ chat.show.appendInfo }}
                    </template>
                    <template v-else>
                        {{
                            list[list.length - 1] ? $t('上次消息 - {time}', {
                                time: Intl.DateTimeFormat(trueLang, {
                                    hour: 'numeric',
                                    minute: 'numeric',
                                    second: 'numeric',
                                }).format(new Date(list[list.length - 1].time * 1000)),
                            }) : $t('暂无消息')
                        }}
                    </template>
                </span>
            </div>
            <div class="space" />
            <div class="chihiro-head-actions">
                <div class="chihiro-bot-wrap">
                    <div class="chihiro-feature-btn" :class="{ on: suggest.enabled }" title="ChatBot" @click.stop="toggleChihiroFeature">
                        <span class="chihiro-ai-symbol" aria-hidden="true">✦</span>
                    </div>
                    <div v-if="suggest.menuOpen" class="chihiro-bot-menu" @click.stop>
                        <div class="chihiro-bot-row">
                            <span>ChatBot</span>
                            <label class="ss-switch chihiro-bot-switch">
                                <input type="checkbox" :checked="suggest.enabled" @change="suggest.setEnabled(!suggest.enabled)">
                                <div><div /></div>
                            </label>
                        </div>
                        <div class="chihiro-bot-row">
                            <span>模式</span>
                            <div class="chihiro-bot-tabs" :class="{ disabled: !suggest.enabled }">
                                <button type="button" :class="{ 'is-on': suggest.mode === 'assist' }" :disabled="!suggest.enabled" @click="suggest.setMode('assist')">辅助</button>
                                <button type="button" :class="{ 'is-on': suggest.mode === 'auto' }" :disabled="!suggest.enabled" @click="suggest.setMode('auto')">自动</button>
                            </div>
                        </div>
                        <div class="chihiro-bot-row">
                            <span>配置</span>
                            <button
                                v-if="suggest.needsAstrBotSetup"
                                type="button"
                                class="chihiro-bot-setup"
                                @click="openChatBotSetup">去配置</button>
                            <div v-else class="select-wrapper chihiro-bot-select">
                                <select :disabled="!suggest.enabled" :value="suggest.configId ?? ''" @change="onSuggestConfigChange">
                                    <option value="">未指定</option>
                                    <option v-for="item in suggest.configs" :key="item.id" :value="item.id">{{ item.name }}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="chihiro-history-btn" :class="{ active: chihiroHistory.open }" :title="$t('搜索消息')" @click.stop="toggleChihiroHistory">
                    <font-awesome-icon :icon="['fas', 'clock-rotate-left']" />
                </div>
                <div class="more" :title="$t('更多')" @click.stop="openChatInfoPan">
                    <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
                </div>
            </div>
        </div>
        <div v-if="chihiroHistory.open" class="chihiro-history-mask" @click.self="closeChihiroHistory">
            <div class="chihiro-history-win" @click.stop>
                <div class="chihiro-history-head">
                    <span class="chihiro-history-title">{{ chat.show.name }}</span>
                    <div class="chihiro-history-close" title="关闭" @click="closeChihiroHistory">
                        <font-awesome-icon :icon="['fas', 'xmark']" />
                    </div>
                </div>
                <div class="chihiro-history-search">
                    <font-awesome-icon :icon="['fas', 'search']" />
                    <input v-model="chihiroHistory.query"
                        :placeholder="$t('搜索')"
                        @input="runChihiroHistorySearch"
                        @keydown.esc.prevent="closeChihiroHistory">
                </div>
                <div class="chihiro-history-tabs">
                    <button type="button" :class="{ active: chihiroHistory.tab === 'all' }" @click="setChihiroHistoryTab('all')">全部</button>
                    <button type="button" :class="{ active: chihiroHistory.tab === 'media' }" @click="setChihiroHistoryTab('media')">图片/视频</button>
                    <button type="button" :class="{ active: chihiroHistory.tab === 'face' }" @click="setChihiroHistoryTab('face')">表情</button>
                    <button type="button" :class="{ active: chihiroHistory.tab === 'file' }" @click="setChihiroHistoryTab('file')">文件</button>
                    <button type="button" :class="{ active: chihiroHistory.tab === 'link' }" @click="setChihiroHistoryTab('link')">链接</button>
                </div>
                <div class="chihiro-history-list">
                    <template v-if="chihiroHistoryGroups().length">
                        <template v-for="group in chihiroHistoryGroups()" :key="group.date">
                            <div class="chihiro-history-date">{{ group.date }}</div>
                            <div v-for="item in group.items"
                                :key="item.message_id || item.fake_message_id"
                                class="chihiro-history-item"
                                @click="jumpChihiroHistory(item)">
                                <img :src="chihiroMsgAvatar(item)">
                                <div class="chihiro-history-text">{{ chihiroMsgPreview(item) }}</div>
                            </div>
                        </template>
                    </template>
                    <div v-else class="chihiro-history-empty">暂无相关记录</div>
                </div>
            </div>
        </div>
        <!-- 加载中指示器 -->
        <div :class=" 'loading' + (uiStore.nowGetHistory && uiStore.canLoadHistory ? ' show' : '')">
            <font-awesome-icon :icon="['fas', 'spinner']" />
            <span>{{ $t('加载中') }}</span>
        </div>
        <!-- 消息显示区 -->
        <div id="msgPan" ref="msgPan" class="chat"
            style="scroll-behavior: smooth"
            @scroll="chatScroll($event, details[3].open)"
            @scrollend="onChatScrollEnd"
            @wheel.passive="onMsgPanWheel">
            <template v-if="!details[3].open">
                <div v-if="!uiStore.canLoadHistory" class="note note-nomsg">
                    <hr>
                    <a>{{ $t('没有更多消息了') }}</a>
                </div>
                <div v-if="uiStore.loadHistoryFail" class="note note-nomsg">
                    <hr>
                    <a>{{ $t('获取历史记录失败') }}</a>
                </div>
                <!-- 日期分割条，下滑加载历史时先标出当前最早一条所在的日子 -->
                <NoticeBody v-if="uiStore.nowGetHistory && list.length > 0"
                    :data="{ sub_type: 'time', time: list[0].time }" />
                <TransitionGroup :name="settingsStore.sysConfig.opt_fast_animation ? '' : 'msglist'" tag="div">
                    <template v-for="(msgIndex, index) in list">
                        <!-- 日期分割条：首条或换日 -->
                        <NoticeBody
                            v-if="isShowTime(list[Number(index) - 1] ? list[Number(index) - 1].time : undefined, msgIndex.time, Number(index) === 0)"
                            :key="'notice-date-' + index"
                            :data="{ sub_type: 'time', time: msgIndex.time }" />
                        <!-- [已删除]消息 -->
                        <NoticeBody
                            v-if="isDeleteMsg(msgIndex)"
                            :key="'delete-' + msgIndex.message_id"
                            :data="{ sub_type: 'delete' }" />
                        <!-- 消息体 -->
                        <MsgBody v-else-if="(msgIndex.post_type === 'message' ||
                                     msgIndex.post_type === 'message_sent') &&
                                     msgIndex.message.length > 0"
                            :key="msgIndex.fake_message_id ?? msgIndex.message_id"
                            :selected="multipleSelectList.includes(msgIndex.message_id)"
                            :selecting="multipleSelectList.length > 0"
                            :data="msgIndex"
                            :image-list-header="chatImg"
                            :show-plus-one="!profileOnly && shouldShowPlusOne(list, Number(index))"
                            v-bind="messageGroupFlags(list, Number(index))"
                            @click="msgClick($event, msgIndex)"
                            @show-menu="showMsgMeun"
                            @plus-one="plusOneMsg"
                            @scroll-to-msg="scrollToMsg"
                            @image-loaded="imgLoadedScroll"
                            @left-move="replyMsg"
                            @send-poke="sendPoke"
                            @open-profile="openProfilePop" />
                        <!-- 其他通知消息 -->
                        <NoticeBody v-else-if="msgIndex.post_type === 'notice'"
                            :id="uuid()"
                            :key="'notice-' + index"
                            :data="msgIndex" />
                    </template>
                </TransitionGroup>
            </template>
            <template v-else>
                <!-- 搜索消息结果显示 -->
                <TransitionGroup
                    :name="settingsStore.sysConfig.opt_fast_animation ? '' : 'msglist'"
                    tag="div">
                    <template v-for="(msgIndex, index) in tags.search.list">
                        <!-- 日期分割条：首条或换日 -->
                        <NoticeBody
                            v-if="isShowTime(tags.search.list[Number(index) - 1] ? tags.search.list[Number(index) - 1].time : undefined, msgIndex.time, Number(index) === 0)"
                            :key="'notice-date-' + index"
                            :data="{ sub_type: 'time', time: msgIndex.time }" />
                        <!-- 消息体 -->
                        <MsgBody v-if=" (msgIndex.post_type === 'message' ||
                                     msgIndex.post_type === 'message_sent') &&
                                     msgIndex.message.length > 0"
                            :key="msgIndex.fake_message_id ?? msgIndex.message_id"
                            :selected="multipleSelectList.includes(msgIndex.message_id)"
                            :selecting="multipleSelectList.length > 0"
                            :data="msgIndex"
                            v-bind="messageGroupFlags(tags.search.list, Number(index))"
                            @scroll-to-msg="scrollToMsg"
                            @show-menu="showMsgMeun"
                            @image-loaded="imgLoadedScroll"
                            @left-move="replyMsg"
                            @open-profile="openProfilePop" />
                    </template>
                </TransitionGroup>
            </template>
            <span ref="chatPadding" class="chat-padding">&nbsp;</span>
        </div>
        <button
            v-if="unreadHintCount > 0"
            type="button"
            class="chihiro-unread-hint"
            @click="jumpToUnread">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M4 7.4 8 3.6 12 7.4"/>
                <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M4 12.4 8 8.6 12 12.4"/>
            </svg>
            <span>{{ unreadHintCount }}条新消息</span>
        </button>
        <!-- 底部区域 -->
        <div id="send-more" ref="sendMore" class="more">
            <!-- 功能附加 -->
            <div>
                <div>
                    <!-- 表情面板 -->
                    <Transition name="pan">
                        <FacePan v-if="details[1].open"
                            @click.stop
                            @add-special-msg="onChihiroFaceAdd" @send-msg="onChihiroFaceSend" />
                    </Transition>
                    <!-- 精华消息 -->
                    <Transition name="pan">
                        <div v-show="details[2].open && chat.info.jin_info.list.length > 0"
                            class="ss-card jin-pan">
                            <div>
                                <font-awesome-icon :icon="['fas', 'message']" />
                                <span>{{ $t('精华消息') }}</span>
                                <font-awesome-icon :icon="['fas', 'xmark']" @click="details[2].open = !details[2].open" />
                            </div>
                            <div
                                class="jin-pan-body"
                                @scroll="jinScroll">
                                <div v-for="(item, index) in chat.info.jin_info.list"
                                    :key="'jin-' + index">
                                    <div>
                                        <img :src="`https://q1.qlogo.cn/g?b=qq&s=0&nk=${item.sender_uin}`">
                                        <div>
                                            <a>{{ item.sender_nick }}</a>
                                            <span>{{ item.sender_time ? Intl.DateTimeFormat(
                                                      trueLang,
                                                      {
                                                          hour: 'numeric',
                                                          minute: 'numeric',
                                                      },
                                                  ).format(new Date(item.sender_time * 1000))
                                                      : '' }}
                                                {{ $t('发送') }}</span>
                                        </div>
                                        <span>{{
                                            $t('{time}，由 {name} 设置', {
                                                time: item.sender_time ? Intl.DateTimeFormat(
                                                    trueLang,
                                                    {
                                                        hour: 'numeric',
                                                        minute: 'numeric',
                                                    },
                                                ).format(new Date(item.sender_time * 1000)) : '',
                                                name: item.add_digest_nick,
                                            })
                                        }}</span>
                                    </div>
                                    <div class="context">
                                        <template
                                            v-for="(context, indexc) in item.msg_content"
                                            :key="'jinc-' + index + '-' + indexc">
                                            <span v-if="context.type === 'text'">
                                                {{ context.data.text }}
                                            </span>
                                            <EmojiFace v-if="context.type === 'face'"
                                                :emoji="Emoji.get(Number(context.data.id))" />
                                            <img v-if="context.type === 'image'"
                                                :src="context.data.url"
                                                @click="viewerEssImg(context.data.url)">
                                        </template>
                                    </div>
                                </div>
                                <div v-show="tags.isJinLoading" class="jin-pan-load">
                                    <font-awesome-icon :icon="['fas', 'spinner']" />
                                </div>
                            </div>
                        </div>
                    </Transition>
                </div>
                <!-- 搜索指示器 -->
                <div :class="details[3].open ? 'search-tag show' : 'search-tag'">
                    <font-awesome-icon :icon="['fas', 'search']" />
                    <span>{{ settingsStore.sysConfig.enable_local_history ? $t('搜索已保存的消息') : $t('搜索已加载的消息') }}</span>
                    <div @click="closeSearch">
                        <font-awesome-icon :icon="['fas', 'xmark']" />
                    </div>
                </div>
                <!-- At 指示器 -->
                <div
                    :class="atFindList != null ? 'at-tag show' : 'at-tag'"
                    contenteditable="true"
                    @blur="choiceAt(undefined)">
                    <div v-for="(item, index) in atFindList != null ? atFindList : []"
                        :key="'atFind-' + item.user_id"
                        :class="{ selected: index === atSelectedIndex }"
                        @click="choiceAt(item.user_id)">
                        <img :src="'https://q1.qlogo.cn/g?b=qq&s=0&nk=' + item.user_id">
                        <span>{{
                            item.card != '' && item.card != null ? item.card : item.nickname
                        }}</span>
                        <a>{{ item.user_id }}</a>
                    </div>
                    <div v-if="atFindList?.length == 0" class="emp">
                        <span>{{ $t('没有找到匹配的群成员') }}</span>
                    </div>
                </div>
                <!-- 更多功能 -->
                <div :class="tags.showMoreDetail ? 'more-detail show' : 'more-detail'">
                    <div
                        :title="$t('图片')"
                        @click="runSelectImg">
                        <font-awesome-icon :icon="['fas', 'image']" />
                    </div>
                    <div
                        :title="$t('文件')"
                        @click="runSelectFile">
                        <font-awesome-icon :icon="['fas', 'folder']" />
                    </div>
                    <div
                        :title="$t('表情')"
                        @click="(details[1].open = !details[1].open),
                                (tags.showMoreDetail = false)">
                        <font-awesome-icon :icon="['fas', 'face-laugh']" />
                    </div>
                    <div v-if="chat.show.type === 'user'"
                        :title="$t('戳一戳')"
                        @click="sendPoke(chat.show.id)">
                        <font-awesome-icon :icon="['fas', 'fa-hand-point-up']" />
                    </div>
                    <div v-if="chat.show.type === 'group'"
                        :title="$t('精华消息')" @click="showJin">
                        <font-awesome-icon :icon="['fas', 'star']" />
                    </div>
                    <div class="space" />
                    <div :title="$t('搜索消息')" @click="openSearch">
                        <font-awesome-icon :icon="['fas', 'search']" />
                    </div>
                </div>
            </div>
            <!-- 消息发送框 -->
            <UserComposer
                ref="composer"
                v-model="msg"
                :selecting="multipleSelectList.length > 0"
                :img-cache="imgCache"
                :is-reply="tags.isReply"
                :reply-name="selectedMsg?.sender?.card || selectedMsg?.sender?.nickname || ''"
                :reply-text="selectedMsg ? getMsgRawTxt(selectedMsg) : ''"
                :show-bottom="tags.showBottomButton"
                :jump-to-latest="latestBelowCount > 0"
                :plus-open="chihiroPlusOpen"
                :face-open="details[1].open"
                :disabled="uiStore.openSideBar || chat.info.me_info.shut_up_timestamp > 0"
                :placeholder="
                    chat.info.me_info.shut_up_timestamp > 0
                        ? $t('已被禁言至：{time}', {
                            time: Intl.DateTimeFormat(
                                trueLang, getTimeConfig(
                                    new Date(chat.info.me_info.shut_up_timestamp * 1000),
                                ),
                            ).format(new Date(chat.info.me_info.shut_up_timestamp * 1000)),
                        }) : $t('发送消息')"
                @submit="mainSubmit"
                @send="mainSubmit"
                @paste="addImg"
                @keydown="mainKey"
                @keyup="mainKeyUp"
                @input-click="selectSQIn"
                @input="handleInput"
                @compositionstart="handleCompositionStart"
                @compositionend="handleCompositionEnd"
                @compositioncancel="handleCompositionCancel"
                @toggle-plus="toggleChihiroPlus"
                @pick-image="pickChihiroImage"
                @pick-file="pickChihiroFile"
                @toggle-face="toggleChihiroFace"
                @jump-bottom="scrollBottom(true)"
                @attach-edit="editImg"
                @attach-delete="deleteImg"
                @cancel-reply="cancelReply"
                @forward-individual="showForWard('individual-messages')"
                @forward-merged="showForWard('merged-messages')"
                @copy="copyMsgs"
                @delete="delMsgs"
                @cancel-select="exitMultipleSelect"
                @select-pic="selectImg"
                @select-file="selectFile">
                <template #assistant><SuggestBar surface="composer" /></template>
                <template #extra>
                    <slot name="main-input-button" />
                </template>
            </UserComposer>
            <div />
        </div>
        <!-- 合并转发消息预览器 -->
        <MergePan ref="mergePan" />
        <!-- 消息右击菜单 -->
        <Teleport to="#chihiro-im-overlays">
            <div :class="'msg-menu' + (['linux', 'win32'].includes(backend.platform ?? '') ? ' withBar' : '') + (tags.showMsgMenu ? ' is-open' : '')">
                <div v-show="tags.showMsgMenu" class="msg-menu-bg" @click="closeMsgMenu" />
                <div id="msgMenu" :class="tags.showMsgMenu ?
                    'ss-card msg-menu-body show' : 'ss-card msg-menu-body'"
                    @click.stop>
                    <div v-if="chatStore.chatInfo.show.type == 'group'"
                        v-show="tags.menuDisplay.showRespond"
                        :class="'ss-card respond' + (tags.menuDisplay.respond ? ' open' : '')">
                        <template v-for="(num, index) in Emoji.responseId" :key="'respond-' + num">
                            <EmojiFace
                                v-if="index < 5 || tags.menuDisplay.respond"
                                :emoji="Emoji.get(num)!"
                                @click="sendRespond(num)" />
                            <font-awesome-icon
                                v-if="index == 4 && !tags.menuDisplay.respond"
                                :icon="['fas', 'angle-up']"
                                @click.stop="tags.menuDisplay.respond = true" />
                        </template>
                    </div>
                    <div v-show="tags.menuDisplay.relpy" @click="menuReplyMsg(true)">
                        <div><font-awesome-icon :icon="['fas', 'message']" /></div>
                        <a>{{ $t('回复') }}</a>
                    </div>
                    <div v-show="tags.menuDisplay.askBot" @click="generateSuggestFromMenu">
                        <div><span class="chihiro-ai-symbol">✦</span></div>
                        <a>生成建议</a>
                    </div>
                    <div v-show="tags.menuDisplay.forward" @click="showForWard()">
                        <div><font-awesome-icon :icon="['fas', 'share']" /></div>
                        <a>{{ $t('转发') }}</a>
                    </div>
                    <div v-show="tags.menuDisplay.select" @click="intoMultipleSelect()">
                        <div><font-awesome-icon :icon="['fas', 'circle-check']" /></div>
                        <a>{{ $t('多选') }}</a>
                    </div>
                    <div v-show="tags.menuDisplay.copy" @click="copyMsg">
                        <div><font-awesome-icon :icon="['fas', 'clipboard']" /></div>
                        <a>{{ $t('复制') }}</a>
                    </div>
                    <div v-show="tags.menuDisplay.copySelect" @click="copySelectMsg">
                        <div><font-awesome-icon :icon="['fas', 'code']" /></div>
                        <a>{{ $t('复制选中文本') }}</a>
                    </div>
                    <div v-show="tags.menuDisplay.copyImg" @click="copyImg">
                        <div><font-awesome-icon :icon="['fas', 'object-ungroup']" /></div>
                        <a>{{ $t('复制图片') }}</a>
                    </div>
                    <div v-show="tags.menuDisplay.downloadImg != false" @click="downloadImg">
                        <div><font-awesome-icon :icon="['fas', 'floppy-disk']" /></div>
                        <a>{{ $t('下载图片') }}</a>
                    </div>
                    <div v-show="tags.menuDisplay.revoke" @click="revokeMsg">
                        <div><font-awesome-icon :icon="['fas', 'xmark']" /></div>
                        <a>{{ $t('撤回') }}</a>
                    </div>
                    <div v-show="tags.menuDisplay.reedit" @click="reeditMsg">
                        <div><font-awesome-icon :icon="['fas', 'pencil']" /></div>
                        <a>{{ $t('重新编辑') }}</a>
                    </div>
                    <div v-show="tags.menuDisplay.at"
                        @click="selectedMsg ? addSpecialMsg({ msgObj: { type: 'at', qq: Number(selectedMsg.sender.user_id) }, addText: true, }): '';
                                toMainInput();
                                closeMsgMenu()">
                        <div><font-awesome-icon :icon="['fas', 'at']" /></div>
                        <a>{{ $t('提及') }}</a>
                    </div>
                    <div v-show="tags.menuDisplay.poke" @click="sendPoke(selectedMsg ? selectedMsg.sender.user_id : undefined)">
                        <div><font-awesome-icon :icon="['fas', 'fa-hand-point-up']" /></div>
                        <a>{{ $t('戳一戳') }}</a>
                    </div>
                    <div v-show="tags.menuDisplay.remove" @click="removeUser">
                        <div><font-awesome-icon :icon="['fas', 'trash-can']" /></div>
                        <a>{{ $t('移出群聊') }}</a>
                    </div>
                    <div v-show="tags.menuDisplay.config"
                        @click="openChatInfoPan();
                                ($refs.infoRef as any).openMoreConfig(selectedMsg?.sender.user_id);
                                closeMsgMenu();">
                        <div><font-awesome-icon :icon="['fas', 'cog']" /></div>
                        <a>{{ $t('成员设置') }}</a>
                    </div>
                    <div v-show="tags.menuDisplay.jumpToMsg" @click="jumpSearchMsg">
                        <div><font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" /></div>
                        <a>{{ $t('跳转到消息') }}</a>
                    </div>
                    <div v-show="isDev" @click="consoleLogMsg">
                        <div><font-awesome-icon :icon="['fas', 'screwdriver-wrench']" /></div>
                        <a>{{ $t('调试信息') }}</a>
                    </div>
                </div>
            </div>
        </Teleport>
        <UserProfilePop
            v-if="profilePop"
            :user-id="profilePop.userId"
            :nickname="profilePop.nickname"
            :card="profilePop.card"
            :anchor="profilePop.anchor"
            @close="closeProfilePop" />
        <!-- 群 / 好友信息弹窗 -->
        <Transition name="chat-info-float" :duration="{ enter: 220, leave: 180 }">
            <Info v-if="tags.openChatInfo" ref="infoRef" :chat="chat" :tags="tags"
                @close="profileOnly ? emit('closeProfile') : openChatInfoPan()"
                @start-chat="onProfileStartChat" />
        </Transition>
        <div v-if="profileOnly && chat.show.type === 'group'" class="contact-profile-actions">
            <button type="button" class="contact-profile-send" @click="emit('startChat')">{{ $t('发送消息') }}</button>
        </div>
        <!-- 转发面板 -->
        <Transition name="forward-float" :duration="{ enter: 220, leave: 180 }">
            <div v-if="tags.showForwardPan" class="forward-pan">
                <div class="ss-card card">
                    <header>
                        <span>{{ $t('转发消息') }}</span>
                        <font-awesome-icon :icon="['fas', 'xmark']" @click="cancelForward" />
                    </header>
                    <label for="chat-forward-search" class="sr-only">{{ $t('搜索转发对象') }}</label>
                    <input id="chat-forward-search" :placeholder="$t('搜索 ……')" @input="searchForward">
                    <div>
                        <div v-for="data in forwardList"
                            :key="forwardContactKey(data)"
                            @click="forwardMsg(data)">
                            <img loading="lazy"
                                :title="getShowName(data.group_name || data.nickname, data.remark)"
                                :src="data.user_id ?
                                    'https://q1.qlogo.cn/g?b=qq&s=0&nk=' + data.user_id :
                                    'https://p.qlogo.cn/gh/' + data.group_id + '/' + data.group_id + '/0'">
                            <div>
                                <p>
                                    {{ data.group_name ?
                                        data.group_name : data.remark === data.nickname ?
                                            data.nickname : data.remark + '（' + data.nickname + '）'
                                    }}
                                </p>
                                <span>{{ data.group_id ? $t('群组') : $t('好友') }}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="bg" @click="cancelForward" />
            </div>
        </Transition>
        <div class="bg" :style="{
            'backdrop-filter': `blur(${!settingsStore.sysConfig.chat_more_blur ? settingsStore.sysConfig .chat_background_blur : 0}px)`
        }" />
    </div>
</template>

<script setup lang="ts">
import app from '@chihiro/im-native/host'
import { i18n } from '@chihiro/im-native/host'
import { useSuggestStore, IDLE_MS, hasSubstantialText } from '@/modules/assistant/suggest'
import SuggestBar from '@/modules/assistant/SuggestBar.vue'
import { useShellStore } from '@/stores/shell'
import { useWorkspace } from '@/modules/workspace/workspace'
import { createHostedAgentNavigation } from '@/modules/agent/native/src/navigation'
import { useRouter } from 'vue-router'
import {
    forwardContactKey,
    hasOutgoingContent as hasComposerContent,
    prioritizeForwardContacts,
} from '@chihiro/im-native/chat-interaction'
import SendUtil from '@renderer/function/sender'
import Option, { get } from '@renderer/function/option'
import Info from '@renderer/pages/user/UserInfo.vue'
import MsgBody from '@renderer/components/user/UserMsgBody.vue'
import UserProfilePop from '@renderer/components/user/UserProfilePop.vue'
import NoticeBody from '@renderer/components/user/UserNoticeBody.vue'
import FacePan from '@renderer/components/user/UserFacePan.vue'
import MergePan from '@renderer/components/user/UserMergePan.vue'
import UserComposer from '@renderer/components/user/UserComposer.vue'
import imageCompression from 'browser-image-compression'

import {
    ref,
    watch,
    onMounted,
    onBeforeUnmount,
    markRaw,
    nextTick,
    reactive,
    inject,
    toRaw,
    useTemplateRef,
} from 'vue'
import { v4 as uuid } from 'uuid'
import {
	scrollToMsg,
    downloadFile,
    loadHistory as loadHistoryFirst,
    shouldAutoFocus,
	vMenu,
	vMove,
	VMoveOptions,
} from '@renderer/function/utils/appUtil'
import {
    copyToClipboard,
    getTimeConfig,
    getTrueLang,
    getViewTime,
} from '@renderer/function/utils/systemUtil'
import {
    getMsgRawTxt,
    sendMsgRaw,
    getShowName,
    isShowTime,
    isDeleteMsg,
    getImageUrlData,
    getDifferencesWithRanges
} from '@renderer/function/utils/msgUtil'
import { Logger, LogType, PopInfo, PopType } from '@renderer/function/base'
import { Connector } from '@renderer/function/connect'
import {
    BaseChatInfoElem,
    MsgItemElem,
    SQCodeElem,
    GroupMemberInfoElem,
    UserFriendElem,
    UserGroupElem,
    MenuEventData,
} from '@renderer/function/elements/information'
import { backend } from '@renderer/runtime/backend'
import { toBackgroundImageStyle } from '@renderer/function/utils/backgroundUtil'
import { dbGetBefore, dbGetBeforeByTime, dbSearchMessages } from '@renderer/function/utils/localHistoryUtil'
import Emoji from '@renderer/function/model/emoji'
import EmojiFace from '@renderer/components/user/UserEmojiFace.vue'
import { Img } from '@renderer/function/model/img'
import { useSessionHistoryStore } from '@renderer/state/sessionHistory'
import { useConnectionStore } from '@renderer/state/connection'
import { useUIStore } from '@renderer/state/ui'
import { useSettingsStore } from '@renderer/state/settings'
import { useAuthStore } from '@renderer/state/auth'
import { useChatStore } from '@renderer/state/chat'
import { useContactStore } from '@renderer/state/contact'
import {
    addUploadTask,
    cancelUploadTask,
    failUploadTask,
} from '@renderer/components/user/UserFileManager.vue'
import {
    countIncomingTail,
    firstUnreadMessage,
    isAtChatBottom,
    isElementAboveContainer,
    nextJumpToBottomVisible,
    sessionUnreadCount,
} from '@chihiro/im-native/chat-scroll-controls'
import {
    plusOneSendSegments,
    shouldShowPlusOne,
} from '@chihiro/im-native/plus-one'
import { messageGroupFlags } from '@chihiro/im-native/message-group'
import {
    captureNativeAsyncScope,
    isNativeAsyncScopeCurrent,
    type NativeAsyncScope,
} from '@renderer/function/asyncAccountScope'

defineOptions({ name: 'UserChat' })

const $t = i18n.global.t
const { viewer: viewerRef } = inject<{ viewer: any }>('viewer', { viewer: null })

const { chat, list, profileOnly = false } = defineProps<{
    chat: any
    list: any[]
    imgView?: any
    profileOnly?: boolean
}>()
const emit = defineEmits<{ startChat: []; closeProfile: [] }>()
let viewGeneration = 0
function currentConversationKey() {
    return `${String(chat.show?.id ?? '')}:${(chat.show as any)?.temp ?? ''}`
}
function captureChatScope(): NativeAsyncScope {
    return captureNativeAsyncScope(
        chat.show?.type ?? '',
        currentConversationKey(),
        viewGeneration,
    )
}
function isChatScopeCurrent(scope: NativeAsyncScope) {
    return isNativeAsyncScopeCurrent(
        scope,
        chat.show?.type ?? '',
        currentConversationKey(),
        viewGeneration,
    )
}
const shell = useShellStore()
const suggest = useSuggestStore()
const workspace = useWorkspace()
const router = useRouter()
const agentNav = createHostedAgentNavigation(router, workspace)
function openChatBotSetup() {
    suggest.closeMenu()
    workspace.selectList('workbench')
    void agentNav.openProviderWorkspace()
}
async function toggleChihiroFeature() {
    if (suggest.menuOpen) {
        suggest.closeMenu()
        return
    }
    if (!suggest.configsReady) await suggest.loadConfigs()
    if (suggest.needsAstrBotSetup) {
        openChatBotSetup()
        return
    }
    suggest.toggleMenu()
}
function onSuggestConfigChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value
    void suggest.setConfigId(value || null)
}
function isSuggestChatMessage(item: any) {
    if (!item || item.fake_msg) return false
    if (item.post_type && item.post_type !== 'message' && item.post_type !== 'message_sent') return false
    if (!item.message_id || !item.message?.length) return false
    return true
}
function conversationSuggestMessages() {
    const self = Number(authStore.loginInfo.uin)
    return list.filter(isSuggestChatMessage).slice(-20).flatMap((item: any) => {
        const text = String(item.raw_message || getMsgRawTxt(item) || '').trim()
        if (!text) return []
        return [{ role: Number(item.sender?.user_id) === self ? 'me' as const : 'them' as const, text }]
    })
}
function lastThemMessage() {
    const self = Number(authStore.loginInfo.uin)
    for (let index = list.length - 1; index >= 0; index--) {
        const item = list[index]
        if (!isSuggestChatMessage(item)) continue
        if (Number(item.sender?.user_id) !== self) return item
    }
    return null
}
function composerHasContent() {
    return hasSubstantialText(composer.value?.getPlainText?.() || msg.value) ||
        Boolean(composer.value?.hasInlineFaces?.() || composer.value?.hasInlineAts?.())
}
function fillSuggest(text: string) {
    const current = (composer.value?.getPlainText?.() || msg.value || '').replace(/\s+$/g, '')
    const next = current ? `${current} ${text}` : text
    composer.value?.setPlainText?.(next)
    msg.value = next
    toMainInput()
}
function sendSuggest(text: string, force = false) {
    if (!text.trim()) return
    if (!force && composerHasContent()) {
        suggest.cancelCountdown()
        return
    }
    const id = chat.show.temp ? chat.show.id + '/' + chat.show.temp : chat.show.id
    sendMsgRaw(id, chat.show.type, [{ type: 'text', text }], true)
    suggest.clearChips()
}
function bindSuggestActions() {
    suggest.bindActions({
        fill: fillSuggest,
        send: sendSuggest,
        inputText: () => composer.value?.getPlainText?.() || msg.value,
    })
}
function syncSuggestContext() {
    if (profileOnly || !shell.activeAccountId || !chat.show?.id) return
    suggest.select({
        accountId: shell.activeAccountId,
        type: chat.show.type === 'group' ? 'group' : 'private',
        peerId: String(chat.show.id),
    })
    bindSuggestActions()
}
function requestAutoSuggest(messageId: string) {
    if (profileOnly || !suggest.enabled || composerHasContent()) return
    void suggest.requestSuggest({
        lastMessageId: messageId,
        trigger: 'auto',
        messages: conversationSuggestMessages(),
    })
}
let suggestIdleTimer: ReturnType<typeof setTimeout> | undefined
let seenSuggestIds = new Set<string>()
let suggestReady = false
function seedSuggestIds() {
    seenSuggestIds = new Set()
    for (const item of list) {
        if (item?.message_id) seenSuggestIds.add(String(item.message_id))
    }
}
function onSuggestIdle() {
    suggest.onOperatorInput()
    if (suggestIdleTimer !== undefined) clearTimeout(suggestIdleTimer)
    suggestIdleTimer = setTimeout(() => {
        suggestIdleTimer = undefined
        const incoming = lastThemMessage()
        if (!incoming) return
        requestAutoSuggest(String(incoming.message_id))
    }, IDLE_MS)
}
function toggleChihiroPlus() {
    chihiroPlusOpen.value = !chihiroPlusOpen.value
    if (chihiroPlusOpen.value) {
        details.value[1].open = false
        tags.value.showMoreDetail = false
    }
}
function closeChihiroPlus() {
    chihiroPlusOpen.value = false
}
function pickChihiroImage() {
    closeChihiroPlus()
    runSelectImg()
}
function pickChihiroFile() {
    closeChihiroPlus()
    runSelectFile()
}
function toggleChihiroFace() {
    details.value[1].open = !details.value[1].open
    tags.value.showMoreDetail = false
    chihiroPlusOpen.value = false
    if (details.value[1].open) chihiroHistory.open = false
}
function closeChihiroFace() {
    details.value[1].open = false
}
function onChihiroFaceAdd(data: SQCodeElem) {
    const obj = data?.msgObj
    if (obj?.type === 'text' && typeof obj.text === 'string') {
        insertTextAtCursor(obj.text)
    } else if (obj?.type === 'face' && obj.id != null && !Number.isNaN(Number(obj.id))) {
        insertFaceAtCursor(Number(obj.id))
    } else if (obj?.type === 'image') {
        const src = stickerSrcFromFile(String(obj.file || obj.url || ''))
        if (src) addAttachSrc(src)
        else addSpecialMsg(data)
    } else {
        addSpecialMsg(data)
    }
    closeChihiroFace()
}
function onChihiroFaceSend(echo?: string) {
    closeChihiroFace()
    sendMsg(echo)
}
function closeChihiroHistory() {
    chihiroHistory.open = false
    chihiroHistory.query = ''
    chihiroHistory.tab = 'all'
    chihiroHistory.list = []
}
function toggleChihiroHistory() {
    if (chihiroHistory.open) {
        closeChihiroHistory()
        return
    }
    details.value[1].open = false
    tags.value.showMoreDetail = false
    chihiroPlusOpen.value = false
    chihiroHistory.open = true
    chihiroHistory.query = ''
    chihiroHistory.tab = 'all'
    runChihiroHistorySearch()
}
function chihiroMsgTypes(item: any): string[] {
    return (item?.message || []).map((seg: any) => seg?.type).filter(Boolean)
}
function chihiroMatchTab(item: any, tab: string) {
    const types = chihiroMsgTypes(item)
    if (tab === 'media') return types.some((t: string) => t === 'image' || t === 'video')
    if (tab === 'face') {
        return types.some((t: string) => t === 'face' || t === 'bface' || t === 'mface') ||
            (item?.message || []).some((seg: any) => seg?.type === 'image' && (seg.subType == 1 || seg.sub_type == 1))
    }
    if (tab === 'file') return types.includes('file')
    if (tab === 'link') {
        try { return /https?:\/\//i.test(getMsgRawTxt(item) || '') } catch { return false }
    }
    return true
}
function chihiroSourceList() {
    return (list || []).filter((item: any) => item && (item.post_type === 'message' || item.post_type === 'message_sent' || !item.post_type))
}
async function runChihiroHistorySearch() {
    const value = String(chihiroHistory.query || '').trim()
    if (searchDebounceTimer.value) {
        clearTimeout(searchDebounceTimer.value)
        searchDebounceTimer.value = null
    }
    const apply = (items: any[]) => {
        const filtered = items.filter((item: any) => chihiroMatchTab(item, chihiroHistory.tab))
        filtered.sort((a: any, b: any) => (b?.time || 0) - (a?.time || 0))
        chihiroHistory.list = filtered
    }
    if (!value) {
        apply(chihiroSourceList())
        return
    }
    if (settingsStore.sysConfig.enable_local_history) {
        const requestId = ++searchRequestId.value
        const scope = captureChatScope()
        searchDebounceTimer.value = setTimeout(async () => {
            let results: any[] = []
            try {
                results = await dbSearchMessages(authStore.loginInfo.uin, chat.show.id, value)
            } catch (e) {
                results = []
            }
            if (
                requestId !== searchRequestId.value ||
                !chihiroHistory.open ||
                !isChatScopeCurrent(scope)
            ) return
            if (!results || results.length === 0) {
                results = chihiroSourceList().filter((item: any) => {
                    try { return getMsgRawTxt(item).indexOf(value) !== -1 } catch { return false }
                })
            }
            apply(results)
        }, 180)
        return
    }
    apply(chihiroSourceList().filter((item: any) => {
        try { return getMsgRawTxt(item).indexOf(value) !== -1 } catch { return false }
    }))
}
function setChihiroHistoryTab(tab: string) {
    chihiroHistory.tab = tab
    runChihiroHistorySearch()
}
function chihiroHistoryGroups() {
    const groups: { date: string, items: any[] }[] = []
    let current: { date: string, items: any[] } | null = null
    for (const item of chihiroHistory.list || []) {
        const d = new Date((item?.time || 0) * 1000)
        if (Number.isNaN(d.getTime())) continue
        const date = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
        if (!current || current.date !== date) {
            current = { date, items: [] }
            groups.push(current)
        }
        current.items.push(item)
    }
    return groups
}
function chihiroMsgPreview(item: any) {
    try { return getMsgRawTxt(item) || '' } catch { return '' }
}
function chihiroMsgAvatar(item: any) {
    const uin = item?.sender?.user_id ?? item?.user_id ?? ''
    if (uin) return `https://q1.qlogo.cn/g?b=qq&s=100&nk=${uin}`
    return chat.show?.avatar || ''
}
function jumpChihiroHistory(item: any) {
    const id = item?.message_id || item?.fake_message_id
    closeChihiroHistory()
    if (!id) return
    const scope = captureChatScope()
    nextTick(() => {
        if (!isChatScopeCurrent(scope)) return
        if (!scrollToMsg(String(id), true)) {
            new PopInfo().add(PopType.INFO, $t('无法定位上下文'))
        }
    })
}


const connectionStore = useConnectionStore()
const uiStore = useUIStore()
const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const chatStore = useChatStore()
const contactStore = useContactStore()
const mergePan = useTemplateRef<InstanceType<typeof MergePan>>('mergePan')
const msgPan = useTemplateRef<HTMLDivElement>('msgPan')
const chatPadding = useTemplateRef<HTMLSpanElement>('chatPadding')
const sendMore = useTemplateRef<HTMLDivElement>('sendMore')
const composer = useTemplateRef<{
    getInput: () => HTMLElement | null
    insertText: (text: string) => void
    insertFace: (id: number) => void
    insertAt: (qq: number | string, name: string) => void
    replaceFromLastAt: (text: string) => void
    replaceLastAtWithMention: (qq: number | string, name: string) => void
    serialize: (cache: MsgItemElem[]) => string
    clear: () => void
    getPlainText: () => string
    hasInlineFaces: () => boolean
    hasInlineAts: () => boolean
    setPlainText: (text: string) => void
}>('composer')
function getMainInput() {
    return composer.value?.getInput?.() ?? null
}

type ForwardAction = 'single-message' | 'individual-messages' | 'merged-messages'

const multipleSelectList = ref<string[]>([])
const profilePop = ref<null | {
    userId: number
    nickname?: string
    card?: string
    anchor: {
        top: number
        left: number
        right: number
        bottom: number
        width: number
        height: number
    }
}>(null)
watch(() => chat.show?.id, () => { profilePop.value = null })
const selectedForwardAction = ref<ForwardAction>('single-message')
const tags = ref({
    sendTag: 'REFUSE' as 'READY' | 'PASS' | 'REFUSE',
    showBottomButton: false,
    showMoreDetail: false,
    showMsgMenu: false,
    showForwardPan: false,
    openChatInfo: false,
    isReply: false,
    isJinLoading: false,
    onAtFind: false,
    menuDisplay: {
        menuSelectedMsgId: null as string | null,
        jumpToMsg: false,
        add: true,
        relpy: true,
        askBot: true,
        forward: true,
        select: true,
        copy: true,
        copySelect: false,
        copyImg: false,
        downloadImg: false as string | false,
        revoke: false,
        reedit: false,
        at: true,
        poke: false,
        remove: false,
        respond: false,
        showRespond: true,
        config: false,
    },
    search: {
        userId: -1,
        list: reactive(list),
    },
    msgTouch: {
        x: -1,
        y: -1,
        msgOnTouchDown: false,
        onMove: 'no',
    },
    checkNewLineFlag: false,
})
const details = ref([
    { open: false },
    { open: false },
    { open: false },
    { open: false },
])
const chihiroHistory = reactive({
    open: false,
    query: '',
    tab: 'all',
    list: [] as any[],
})
const chihiroPlusOpen = ref(false)
function onChihiroDocClick(e: Event) {
    const t = e.target as HTMLElement | null
    if (tags.value.showMsgMenu && !(e instanceof MouseEvent && e.button !== 0)) {
        if (t && typeof t.closest === 'function' && t.closest('#msgMenu')) return
        closeMsgMenu()
    }
    if (t && typeof t.closest === 'function' && t.closest('.chihiro-bot-wrap')) return
    if (suggest.menuOpen) suggest.closeMenu()
    if (t && typeof t.closest === 'function' && (
        t.closest('.face-pan') ||
        t.closest('.chihiro-face-btn') ||
        t.closest('.chihiro-input-face')
    )) return
    if (t && typeof t.closest === 'function' && t.closest('.chihiro-plus-wrap')) return
    if (details.value[1].open) details.value[1].open = false
    if (chihiroPlusOpen.value) chihiroPlusOpen.value = false
}
function onChihiroDocKey(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    if (tags.value.openChatInfo) return
    if (tags.value.showMsgMenu) {
        closeMsgMenu()
        e.preventDefault()
        return
    }
    if (profilePop.value) {
        profilePop.value = null
        e.preventDefault()
        return
    }
    if (multipleSelectList.value.length > 0) {
        exitMultipleSelect()
        e.preventDefault()
        return
    }
    if (chihiroHistory.open) {
        closeChihiroHistory()
        return
    }
    if (chihiroPlusOpen.value) {
        chihiroPlusOpen.value = false
        return
    }
    if (suggest.menuOpen) {
        suggest.closeMenu()
        return
    }
    if (details.value[1].open) details.value[1].open = false
}
document.addEventListener('click', onChihiroDocClick)
document.addEventListener('keydown', onChihiroDocKey)
const msgMenus = ref<any[]>([])
const unreadHintCount = ref(0)
const unreadAnchorId = ref<string | null>(null)
const pendingEnterUnread = ref(0)
const latestBelowCount = ref(0)
let followingBottom = true
let lastScrollTop = 0
let programmaticScroll = 0
let settlingToBottom = false
let settleToBottomTimer: ReturnType<typeof setTimeout> | undefined
const msg = ref('')
const oldMsg = ref('')
const IME_ENTER_GUARD_MS = 80
let imeComposing = false
let lastImeCompositionEndAt = 0
const imgCache = ref(new Map<number, string>())
const sendCache = ref<MsgItemElem[]>([])
const selectedMsg = ref<{ [key: string]: any } | null>(null)
const selectCache = ref('')
const atFindList = ref<GroupMemberInfoElem[] | null>(null)
const atSelectedIndex = ref(0)
const atScrollTimer = ref<NodeJS.Timeout | null>(null)
const atScrollInterval = ref<NodeJS.Timeout | null>(null)
const searchDebounceTimer = ref<NodeJS.Timeout | null>(null)
const searchRequestId = ref(0)
const forwardList = ref(contactStore.userList)
const chatImg = ref<any>(undefined)
const trueLang = getTrueLang()
const isDev = import.meta.env.DEV

//#region == 窗口移动相关 ==================================================
const chatMoveOptions: VMoveOptions<HTMLDivElement> = {
    beforeHook: (_) => {
        const target = getTargetWin()
        if (!target) return
        target.style.transition = 'all 0s'
        const pan = document.getElementById('chat-pan')
        if (!pan) return
        const chatEl = pan.getElementsByClassName('chat')[0] as HTMLDivElement
        if(chatEl)
            chatEl.style.overflowY = 'hidden'
    },
    moveHook: (_, move: number) => {
        const target = getTargetWin()
        if (!target) return
        target.style.transform = 'translateX(' + move + 'px)'
    },
    endHook: (_) => {
        const pan = document.getElementById('chat-pan')
        const chatEl = pan?.getElementsByClassName('chat')[0] as HTMLDivElement
        if(chatEl) {
            chatEl.style.overflowY = 'scroll'
        }
        const target = getTargetWin()
        if (!target) return
        target.style.transition = 'transform 0.3s'
        target.style.transform = ''
    },
    rightLimit: {
        value: 100,
        type: '%',
    },
    speedCondition: {
        minMove: {
            value: 0.5 * uiStore.inch,
            type: 'px',
        },
        minSpeed: 5 * uiStore.inch,
    },
    moveCondition: {
        minMove: {
            value: 33,
            type: '%',
        }
    },
}
//#endregion

function resetState() {
    chihiroHistory.open = false
    chihiroHistory.query = ''
    chihiroHistory.tab = 'all'
    chihiroHistory.list = []
    imeComposing = false
    lastImeCompositionEndAt = 0
    tags.value = {
        sendTag: 'REFUSE',
        showBottomButton: false,
        showMoreDetail: false,
        showMsgMenu: false,
        showForwardPan: false,
        openChatInfo: false,
        isReply: false,
        isJinLoading: false,
        onAtFind: false,
        menuDisplay: {
            menuSelectedMsgId: null,
            jumpToMsg: false,
            add: true,
            relpy: true,
            askBot: true,
            forward: true,
            select: true,
            copy: true,
            copySelect: false,
            copyImg: false,
            downloadImg: false,
            revoke: false,
            reedit: false,
            at: true,
            poke: false,
            remove: false,
            respond: false,
            showRespond: true,
            config: false,
        },
        search: {
            userId: -1,
            list: reactive(list),
        },
        msgTouch: {
            x: -1,
            y: -1,
            msgOnTouchDown: false,
            onMove: 'no',
        },
        checkNewLineFlag: false,
    }
    msgMenus.value = []
    selectedMsg.value = null
}

watch(() => chat.show?.id, (id) => {
    const sessionId = Number(id)
    const session = Number.isFinite(sessionId) ? contactStore.baseOnMsgList.get(sessionId) : undefined
    const assist = Number.isFinite(sessionId)
        ? contactStore.groupAssistList.find((item) => Number(item.group_id ?? item.user_id) === sessionId)
        : undefined
    pendingEnterUnread.value = profileOnly
        ? 0
        : Math.max(
            sessionUnreadCount(session),
            sessionUnreadCount(assist),
            sessionUnreadCount({ unread: chat.show?.enterUnread }),
        )
    unreadHintCount.value = 0
    unreadAnchorId.value = null
    latestBelowCount.value = 0
    followingBottom = true
    lastScrollTop = 0
    stopSettlingToBottom()
    tags.value.showBottomButton = false
}, { flush: 'sync', immediate: true })

watch(currentConversationKey, () => {
    suggestReady = false
    seedSuggestIds()
    if (suggestIdleTimer !== undefined) {
        clearTimeout(suggestIdleTimer)
        suggestIdleTimer = undefined
    }
    syncSuggestContext()
    nextTick(() => {
        seedSuggestIds()
        suggestReady = true
    })
    viewGeneration++
    searchRequestId.value++
    if (searchDebounceTimer.value) {
        clearTimeout(searchDebounceTimer.value)
        searchDebounceTimer.value = null
    }
    uiStore.nowGetHistory = false
    resetState()
    sendCache.value = []
    imgCache.value = new Map()
    composer.value?.clear?.()
    multipleSelectList.value = []
    initMenuDisplay()
    const nextViewGeneration = viewGeneration
    nextTick(() => {
        if (nextViewGeneration !== viewGeneration) return
        scheduleResizeMainInput()
    })
    const history = useSessionHistoryStore()
    const sessionId = chat.show.id
    const session = [...contactStore.userList].find(i => (i.user_id ?? i.group_id) === sessionId)
    if (session && !profileOnly) history.add(session)
})

watch(() => msg.value, (_newMsg, oldMsgVal) => {
    oldMsg.value = oldMsgVal
    scheduleResizeMainInput()
    onSuggestIdle()
})

watch(() => [suggest.generating, suggest.replies.length] as const, () => {
    nextTick(() => {
        scheduleChatPaddingUpdate(followingBottom ? () => {
            const pan = document.getElementById('msgPan')
            if (pan) scrollTo(pan.scrollHeight, false)
        } : undefined)
    })
})

watch(() => profileOnly, (value) => {
    if (value && !tags.value.openChatInfo) openChatInfoPan()
    if (!value) {
        tags.value.openChatInfo = false
        const session = contactStore.baseOnMsgList.get(chat.show.id)
        if (session) useSessionHistoryStore().add(session)
    }
})

onMounted(() => {
    bindSuggestActions()
    syncSuggestContext()
    seedSuggestIds()
    suggestReady = true
    const history = useSessionHistoryStore()
    const sessionId = chat.show.id
    const session = [...contactStore.userList].find(i => (i.user_id ?? i.group_id) === sessionId)
    if (session && !profileOnly) history.add(session)
    if (profileOnly) openChatInfoPan()

    updateList(list.length, 0)
    watch(() => list.map((item) => item.message_id + '_' + item.fake_msg),
        (newIds, oldIds = []) => {
            updateList(newIds.length, oldIds.length)
            const last = list[list.length - 1]
            const lastId = last ? String(last.message_id || '') : ''
            if (suggestReady && oldIds.length > 0 && newIds.length >= oldIds.length && lastId && !seenSuggestIds.has(lastId) && String(lastThemMessage()?.message_id) === lastId) {
                requestAutoSuggest(lastId)
            }
            for (const item of list) {
                if (item?.message_id) seenSuggestIds.add(String(item.message_id))
            }
        },
    )
    watch(() => chat.info.jin_info?.list?.length ?? 0, () => {
            tags.value.isJinLoading = false
        },
    )
    if(backend.type == 'capacitor' && backend.platform === 'android') {
        backend.addListener('App', 'backButton', () => {
            exitWin()
        })
    }
    watch(() => connectionStore.backTimes, () => {
        exitWin()
    })
    nextTick(() => {
        setupChatPaddingObserver()
        scheduleResizeMainInput()
    })
    window.addEventListener('chihiro-viewer-forward', onViewerForward as EventListener)
    window.addEventListener('chihiro-viewer-delete', onViewerDelete as EventListener)
    window.addEventListener('chihiro-viewer-edit-send', onViewerEditSend as EventListener)
})

onBeforeUnmount(() => {
    viewGeneration++
    searchRequestId.value++
    if (suggestIdleTimer !== undefined) {
        clearTimeout(suggestIdleTimer)
        suggestIdleTimer = undefined
    }
    suggest.closeMenu()
    stopSettlingToBottom()
    if (searchDebounceTimer.value) {
        clearTimeout(searchDebounceTimer.value)
        searchDebounceTimer.value = null
    }
    document.removeEventListener('click', onChihiroDocClick)
    document.removeEventListener('keydown', onChihiroDocKey)
    window.removeEventListener('chihiro-viewer-forward', onViewerForward as EventListener)
    window.removeEventListener('chihiro-viewer-delete', onViewerDelete as EventListener)
    window.removeEventListener('chihiro-viewer-edit-send', onViewerEditSend as EventListener)
    if (resizeMainInputFrame !== null) {
        cancelAnimationFrame(resizeMainInputFrame)
        resizeMainInputFrame = null
    }
    if (chatPaddingFrame !== null) {
        cancelAnimationFrame(chatPaddingFrame)
        chatPaddingFrame = null
    }
    if (sendMoreResizeObserver !== null) {
        sendMoreResizeObserver.disconnect()
        sendMoreResizeObserver = null
    }
})

let resizeMainInputFrame: number | null = null
let chatPaddingFrame: number | null = null
let sendMoreResizeObserver: ResizeObserver | null = null
let chatPaddingAfterUpdate: Array<() => void> = []
const COMPOSER_INPUT_HEIGHT = 36
const TEXTAREA_SCROLL_HEIGHT_COMPACT_OFFSET = 4

function scheduleResizeMainInput(target?: HTMLElement | null, keepBottom = false) {
    // The template switches between input and textarea, so measure only after Vue
    // has applied the branch and coalesce rapid input changes into one frame.
    nextTick(() => {
        if (resizeMainInputFrame !== null) {
            cancelAnimationFrame(resizeMainInputFrame)
        }
        resizeMainInputFrame = requestAnimationFrame(() => {
            resizeMainInputFrame = null
            resizeMainInput(target ?? getMainInput())
            scheduleChatPaddingUpdate(keepBottom ? () => scrollBottom() : undefined)
        })
    })
}

function updateChatPadding() {
    const morePan = sendMore.value
    const padding = chatPadding.value
    const chatPan = msgPan.value
    if (!morePan || !padding || !chatPan) return

    const scrollbarGap = morePan.querySelector('.chihiro-suggest-bar') ? 20 : 12
    chatPan.style.setProperty('margin-bottom', `${morePan.offsetHeight + scrollbarGap}px`, 'important')

    const contentBlocks = Array.from(morePan.children)
        .flatMap(child => Array.from(child.children))
        .filter((child): child is HTMLElement =>
            child instanceof HTMLElement && child.offsetHeight > 0,
        )
    const contentTop = contentBlocks.length > 0? contentBlocks.reduce(
            (top, child) => Math.min(top, child.getBoundingClientRect().top),
            Number.POSITIVE_INFINITY,
        ): morePan.getBoundingClientRect().top
    const chatBottom = chatPan.getBoundingClientRect().bottom
    padding.style.height = Math.max(0, chatBottom - contentTop) + 'px'
}

function scheduleChatPaddingUpdate(afterUpdate?: () => void) {
    if (afterUpdate) {
        chatPaddingAfterUpdate.push(afterUpdate)
    }
    if (chatPaddingFrame !== null) {
        return
    }
    chatPaddingFrame = requestAnimationFrame(() => {
        chatPaddingFrame = null
        updateChatPadding()
        const callbacks = chatPaddingAfterUpdate
        chatPaddingAfterUpdate = []
        callbacks.forEach(callback => callback())
    })
}

function setupChatPaddingObserver() {
    if (sendMoreResizeObserver !== null) return
    const morePan = sendMore.value
    if (!morePan || typeof ResizeObserver === 'undefined') {
        scheduleChatPaddingUpdate()
        return
    }
    sendMoreResizeObserver = new ResizeObserver(() => {
        scheduleChatPaddingUpdate()
    })
    sendMoreResizeObserver.observe(morePan)
    scheduleChatPaddingUpdate()
}

function resizeMainInput(target?: HTMLElement | null) {
    const input = target ?? getMainInput()
    if (!input) return
    const empty = composer.value?.getPlainText?.() === '' &&
        !composer.value?.hasInlineFaces?.() &&
        !composer.value?.hasInlineAts?.()
    if (!Option.get('use_breakline')) {
        input.style.height = COMPOSER_INPUT_HEIGHT + 'px'
        input.classList.remove('is-multiline')
        return
    }

    const oldTransition = input.style.transition
    input.style.transition = 'none'

    if (empty) {
        input.classList.remove('is-multiline')
        input.style.height = COMPOSER_INPUT_HEIGHT + 'px'
    } else {
        const oldOverflow = input.style.overflow
        input.classList.add('is-multiline')
        input.style.overflow = 'hidden'
        input.style.height = '0px'
        const targetHeight = Math.max(
            input.scrollHeight - TEXTAREA_SCROLL_HEIGHT_COMPACT_OFFSET,
            COMPOSER_INPUT_HEIGHT,
        )
        const multiline = targetHeight > COMPOSER_INPUT_HEIGHT + 1
        input.classList.toggle('is-multiline', multiline)
        input.style.height = (multiline ? targetHeight : COMPOSER_INPUT_HEIGHT) + 'px'
        input.style.overflow = oldOverflow
    }

    input.getBoundingClientRect()
    input.style.transition = oldTransition
}
function jumpSearchMsg() {
    closeSearch()
    const scope = captureChatScope()
    setTimeout(() => {
        if (!isChatScopeCurrent(scope)) return
        if (!selectedMsg.value) return
        scrollToMsg('chat-' + selectedMsg.value?.message_id, true)
        closeMsgMenu()
    }, 100)
}

function beginProgrammaticScroll() {
    programmaticScroll += 1
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            programmaticScroll = Math.max(0, programmaticScroll - 1)
        })
    })
}

function stopSettlingToBottom() {
    settlingToBottom = false
    if (settleToBottomTimer !== undefined) {
        clearTimeout(settleToBottomTimer)
        settleToBottomTimer = undefined
    }
}

function armSettleIdleTimer() {
    if (settleToBottomTimer !== undefined) clearTimeout(settleToBottomTimer)
    settleToBottomTimer = setTimeout(() => {
        settleToBottomTimer = undefined
        settlingToBottom = false
    }, 250)
}

function startSettlingToBottom() {
    settlingToBottom = true
    tags.value.showBottomButton = false
    document.querySelector('.chihiro-jump-bottom')?.classList.remove('is-on')
    armSettleIdleTimer()
}

function onMsgPanWheel(event: WheelEvent) {
    if (settlingToBottom && event.deltaY < 0) stopSettlingToBottom()
}

function onChatScrollEnd(event: Event) {
    const body = event.target as HTMLDivElement
    if (!settlingToBottom) return
    if (isAtChatBottom(body.scrollTop, body.clientHeight, body.scrollHeight)) {
        stopSettlingToBottom()
    }
}

function hideUnreadHintIfReached(container: HTMLElement) {
    if (unreadHintCount.value <= 0 || !unreadAnchorId.value) return
    const el = document.getElementById('chat-' + unreadAnchorId.value)
    if (el && !isElementAboveContainer(el, container)) {
        unreadHintCount.value = 0
        pendingEnterUnread.value = 0
    }
}

function refreshUnreadHint() {
    const count = pendingEnterUnread.value
    if (count <= 0) {
        unreadHintCount.value = 0
        unreadAnchorId.value = null
        return
    }
    const target = firstUnreadMessage(list, count, authStore.loginInfo.uin)
    const pan = document.getElementById('msgPan')
    if (!target || !pan) {
        unreadHintCount.value = 0
        unreadAnchorId.value = null
        return
    }
    unreadAnchorId.value = String(target.message_id)
    const el = document.getElementById('chat-' + unreadAnchorId.value)
    unreadHintCount.value = isElementAboveContainer(el, pan) ? count : 0
}

function jumpToUnread() {
    const id = unreadAnchorId.value
    unreadHintCount.value = 0
    pendingEnterUnread.value = 0
    if (id) {
        beginProgrammaticScroll()
        scrollToMsg('chat-' + id, true)
    }
}

function chatScroll(event: Event, pass: boolean) {
    if(pass) return

    const body = event.target as HTMLDivElement
    if (body.scrollTop === 0 && list.length > 0) {
        loadMoreHistory()
    }
    const atBottom = isAtChatBottom(body.scrollTop, body.clientHeight, body.scrollHeight)
    const delta = body.scrollTop - lastScrollTop
    lastScrollTop = body.scrollTop
    hideUnreadHintIfReached(body)
    if (settlingToBottom) {
        if (atBottom) stopSettlingToBottom()
        else armSettleIdleTimer()
    }
    if (atBottom) {
        followingBottom = true
        latestBelowCount.value = 0
    } else if (!programmaticScroll && !settlingToBottom && Math.abs(delta) > 4) {
        followingBottom = false
    }
    tags.value.showBottomButton = nextJumpToBottomVisible({
        atBottom,
        delta,
        visible: tags.value.showBottomButton,
        settling: settlingToBottom || programmaticScroll > 0,
        hasLatestBelow: latestBelowCount.value > 0,
    })
}

async function loadMoreHistory() {
    if (
        !uiStore.nowGetHistory &&
        uiStore.canLoadHistory !== false
    ) {
        const scope = captureChatScope()
        const firstMsgId = list[0].message_id
        const firstMsgTime = Number(list[0]?.time)
        const useMixedHistory =
            settingsStore.sysConfig.enable_local_history &&
            settingsStore.sysConfig.mixed_load_messages !== false
        uiStore.nowGetHistory = true
        if (useMixedHistory && Number.isFinite(firstMsgTime)) {
            uiStore.historyBeforeTime = firstMsgTime
        } else {
            uiStore.historyBeforeTime = undefined
        }
        uiStore.loadHistoryFail = false

        if (useMixedHistory) {
            let localMsgs = [] as any[]
            if (Number.isFinite(firstMsgTime)) {
                localMsgs = await dbGetBeforeByTime(
                    authStore.loginInfo.uin,
                    chatStore.chatInfo.show.id,
                    firstMsgTime,
                    20,
                )
            } else {
                localMsgs = await dbGetBefore(
                    authStore.loginInfo.uin,
                    chatStore.chatInfo.show.id,
                    firstMsgId,
                    20,
                )
            }
            if (!isChatScopeCurrent(scope)) return
            if (localMsgs.length > 0) {
                const existingIds = new Set(chatStore.messageList.map((m) => String(m.message_id ?? '')))
                const addList = localMsgs.filter((m) => {
                    const msgId = String(m?.message_id ?? '')
                    return msgId.length === 0 || !existingIds.has(msgId)
                })
                if (addList.length > 0) {
                    chatStore.messageList.splice(0, 0, ...addList)
                }
                const boundary = list[addList.length] ?? list[addList.length - 1]
                const seqGapAnchors = detectSeqGaps([...addList, boundary])
                if (seqGapAnchors.length > 0) {
                    fillSeqGaps(seqGapAnchors)
                }
            }
        }

        const fullPage =
            authStore.jsonMap.message_list?.pagerType == 'full'
        const type = chatStore.chatInfo.show.type
        const id = chatStore.chatInfo.show.id
        if (!isChatScopeCurrent(scope)) return
        let name
        if (authStore.jsonMap.message_list && type != 'group') {
            name = authStore.jsonMap.message_list.private_name
        } else {
            name = authStore.jsonMap.message_list.name
        }
        Connector.send(
            name ?? 'get_chat_history',
            {
                group_id: type == 'group' ? id : undefined,
                user_id: type != 'group' ? id : undefined,
                message_id: firstMsgId,
                count: fullPage? chatStore.messageList.length + 20: 20,
            },
            'getChatHistory',
        )
    }
}

function detectSeqGaps(msgs: any[]): string[] {
    const gaps: string[] = []
    for (let i = 0; i < msgs.length - 1; i++) {
        const seqA: number | null = msgs[i].message_seq ?? msgs[i].seq ?? null
        const seqB: number | null = msgs[i + 1].message_seq ?? msgs[i + 1].seq ?? null
        if (seqA == null || seqB == null) return []
        if (seqB - seqA > 1) {
            gaps.push(msgs[i + 1].message_id)
        }
    }
    return gaps
}

function fillSeqGaps(anchorMsgIds: string[]) {
    const type = chatStore.chatInfo.show.type
    const id = chatStore.chatInfo.show.id
    let name: string
    if (authStore.jsonMap.message_list && type != 'group') {
        name = authStore.jsonMap.message_list.private_name
    } else {
        name = authStore.jsonMap.message_list?.name
    }
    for (const anchorMsgId of anchorMsgIds) {
        Connector.send(
            name ?? 'get_chat_history',
            {
                group_id: type == 'group' ? id : undefined,
                user_id: type != 'group' ? id : undefined,
                message_id: anchorMsgId,
                count: 20,
            },
            'getChatHistoryGapFill_' + anchorMsgId,
        )
    }
}

function scrollTo(where: number | undefined, showAnimation = true) {
    const pan = document.getElementById('msgPan')
    if (pan !== null && where) {
        beginProgrammaticScroll()
        if (showAnimation === false) {
            pan.style.scrollBehavior = 'unset'
        } else {
            startSettlingToBottom()
            pan.style.scrollBehavior = 'smooth'
        }
        pan.scrollTop = where
        pan.style.scrollBehavior = 'smooth'
        if (showAnimation === false) lastScrollTop = pan.scrollTop
    }
}

function scrollBottom(showAnimation = false) {
    const pan = document.getElementById('msgPan')
    if (pan !== null) {
        followingBottom = true
        latestBelowCount.value = 0
        if (isAtChatBottom(pan.scrollTop, pan.clientHeight, pan.scrollHeight)) {
            stopSettlingToBottom()
            tags.value.showBottomButton = false
            return
        }
        startSettlingToBottom()
        scrollTo(pan.scrollHeight, showAnimation)
    }
}

function scrollToMsgLocal(message_id: string) {
    if (!scrollToMsg(message_id, true)) {
        new PopInfo().add(PopType.INFO, $t('无法定位上下文'))
    }
}

function imgLoadedScroll(height: number) {
    const pan = document.getElementById('msgPan')
    if(pan) {
        if(list.length <= 20 && followingBottom) {
            scrollBottom()
        } else {
            scrollTo(pan.scrollTop + height, false)
        }
        if (pendingEnterUnread.value > 0) refreshUnreadHint()
    }
}

function isImeInputEvent(event: KeyboardEvent) {
    if (imeComposing || event.isComposing) return true
    if (event.keyCode === 229) return true
    if (tags.value.sendTag === 'PASS') return true
    if (
        lastImeCompositionEndAt > 0 &&
        typeof event.timeStamp === 'number' &&
        event.timeStamp >= lastImeCompositionEndAt &&
        event.timeStamp - lastImeCompositionEndAt < IME_ENTER_GUARD_MS
    ) {
        return true
    }
    return false
}

function mainKey(event: KeyboardEvent) {
    // 输入法选词 / 组字中的按键交给 IME，不发送、不抢 @ 列表
    if (isImeInputEvent(event)) return

    if (mainAtKey(event)) return

    if(tags.value.onAtFind) return
    if (event.key !== 'Enter') return
    // Chihiro: Enter 发送，Shift+Enter 换行
    if (event.shiftKey) return
    event.preventDefault()
    if (hasOutgoingContent()) {
        sendMsg()
    }
    tags.value.sendTag = 'REFUSE'
}

function mainAtKey(event: KeyboardEvent) {
    if (!tags.value.onAtFind) return false

    if (event.keyCode === 38 || event.keyCode === 40) {
        event.preventDefault()
        const direction = event.keyCode === 38 ? -1 : 1
        moveAtSelection(direction)
        if (atScrollTimer.value !== null) return true
        atScrollTimer.value = setTimeout(() => {
            atScrollInterval.value = setInterval(() => {
                moveAtSelection(direction)
            }, 50)
        }, 300)
        return true
    }

    if (event.keyCode === 13) {
        event.preventDefault()
        const selectedMember = atFindList.value?.[atSelectedIndex.value]
        if (selectedMember) {
            choiceAt(selectedMember.user_id)
        }
        return true
    }

    if (event.keyCode === 27) {
        event.preventDefault()
        tags.value.onAtFind = false
        atFindList.value = null
        atSelectedIndex.value = 0
        return true
    }

    return false
}

function handleCompositionStart() {
    imeComposing = true
    tags.value.sendTag = 'REFUSE'
}

function handleCompositionEnd(event?: CompositionEvent) {
    imeComposing = false
    lastImeCompositionEndAt = event?.timeStamp || performance.now()
    tags.value.sendTag = 'PASS'
    window.setTimeout(() => {
        if (!imeComposing) tags.value.sendTag = 'REFUSE'
    }, IME_ENTER_GUARD_MS)
}

function handleCompositionCancel() {
    imeComposing = false
    lastImeCompositionEndAt = 0
    tags.value.sendTag = 'REFUSE'
}

function mainKeyUp(event: KeyboardEvent) {
    const logger = new Logger()

    if (event.keyCode === 27) {
        if (chihiroHistory.open) {
            closeChihiroHistory()
            return
        }
        if (details.value[1].open) {
            details.value[1].open = false
            return
        }
        return
    }

    if (event.keyCode === 38 || event.keyCode === 40) {
        if (atScrollTimer.value !== null) {
            clearTimeout(atScrollTimer.value)
            atScrollTimer.value = null
        }
        if (atScrollInterval.value !== null) {
            clearInterval(atScrollInterval.value)
            atScrollInterval.value = null
        }
    }

    if (tags.value.checkNewLineFlag){
        tags.value.checkNewLineFlag = false
        if (msg.value == '\n'){
            msg.value = ''
            scheduleResizeMainInput()
        }
    }

    if (tags.value.onAtFind && atFindList.value && atFindList.value.length > 0) {
        if (event.keyCode === 38 || event.keyCode === 40 || event.keyCode === 13 || event.keyCode === 27) {
            return
        }
    }

    if (event.keyCode != 13) {
        const lastInput = msg.value.substring(msg.value.length - 1)
        if (
            !tags.value.onAtFind &&
            lastInput == '@' &&
            chatStore.chatInfo.info.group_members.length > 0 &&
            chatStore.chatInfo.show.type == 'group'
        ) {
            logger.add(LogType.UI, '开始匹配群成员列表 ……')
            tags.value.onAtFind = true
            atSelectedIndex.value = 0
        }
        if (tags.value.onAtFind) {
            if (msg.value.lastIndexOf('@') < 0) {
                logger.add(LogType.UI, '匹配群成员列表被打断 ……')
                tags.value.onAtFind = false
                atFindList.value = null
                atSelectedIndex.value = 0
            } else {
                const atInfo = msg.value
                    .substring(msg.value.lastIndexOf('@') + 1)
                    .toLowerCase()
                atFindList.value = chatStore.chatInfo.info.group_members
                        .filter((item) => { return (
                                (item.card != '' && item.card != null && item.card.toLowerCase().indexOf(atInfo) >=0) ||
                                item.nickname.toLowerCase().indexOf(atInfo) >= 0 ||
                                atInfo ==item.user_id.toString()
                            )
                        },
                    )
                if (atFindList.value.length == 0) {
                    atFindList.value = chatStore.chatInfo.info.group_members
                }
                atSelectedIndex.value = 0
            }
        }
    }
}

function mainSubmit(event?: Event) {
    event?.preventDefault()
    if (imeComposing) return
    if (hasOutgoingContent()) {
        sendMsg()
    }
}

function choiceAt(id: number | undefined) {
    if (id != undefined) {
        const name = atDisplayName(id)
        if (composer.value?.replaceLastAtWithMention) {
            composer.value.replaceLastAtWithMention(id, name)
        } else {
            msg.value = msg.value.substring(0, msg.value.lastIndexOf('@')) + '@' + name + ' '
        }
    }
    toMainInput()
    tags.value.onAtFind = false
    atFindList.value = null
    atSelectedIndex.value = 0
}

function scrollAtListToSelected() {
    nextTick(() => {
        const container = document.querySelector('.at-tag.show')
        const selectedItem = document.querySelector('.at-tag.show > div.selected')
        if (container && selectedItem) {
            const containerRect = container.getBoundingClientRect()
            const itemRect = selectedItem.getBoundingClientRect()
            if (itemRect.top < containerRect.top) {
                selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
            } else if (itemRect.bottom > containerRect.bottom) {
                selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
            }
        }
    })
}

function moveAtSelection(direction: number) {
    if (!atFindList.value || atFindList.value.length === 0) return
    if (direction === -1) {
        atSelectedIndex.value = atSelectedIndex.value > 0? atSelectedIndex.value - 1: atFindList.value.length - 1
    } else {
        atSelectedIndex.value = atSelectedIndex.value < atFindList.value.length - 1? atSelectedIndex.value + 1: 0
    }
    scrollAtListToSelected()
}

function selectSQIn() {
    const input = (document.getElementById( 'main-input') as HTMLTextAreaElement | HTMLInputElement | null) ??
        (document.getElementById( 'main-input-ex') as HTMLTextAreaElement | HTMLInputElement | null)
    if (
        input !== null &&
        input.selectionStart === input.selectionEnd
    ) {
        let cursurPosition = -1
        if (typeof input.selectionStart === 'number') {
            cursurPosition = input.selectionStart
        }
        const getSQCode = SendUtil.getSQList(msg.value)
        if (getSQCode != null) {
            getSQCode.forEach((item) => {
                const start = msg.value.indexOf(item)
                const end = start + item.length
                if (
                    start !== -1 &&
                    cursurPosition > start &&
                    cursurPosition < end
                ) {
                    nextTick(() => {
                        input.selectionStart = start
                        input.selectionEnd = end
                    })
                }
            })
        }
    }
}

function showMsgMeun(event: MenuEventData, data: any) {
    selectedMsg.value = data
    tags.value.menuDisplay.menuSelectedMsgId = data.message_id

    if (Option.get('log_level') === 'debug') {
        new Logger().debug('右击消息：' + data)
    }
    if (multipleSelectList.value.length > 0) {
        return
    }

    const menu = document.getElementById('msgMenu')
    const select = event.target as HTMLElement
    let selectUserType = 'member'
    if (
        chatStore.chatInfo.show.type == 'group' &&
        chatStore.chatInfo.info.group_members
    ) {
        chatStore.chatInfo.info.group_members.forEach(
            (item: any) => {
                if (item.user_id == data.sender.user_id) {
                    selectUserType = item.role
                }
            },
        )
    }

    if (menu !== null && data !== null) {
        if (get('close_respond') == true) {
            tags.value.menuDisplay.showRespond = false
        }
        if (
            select.nodeName == 'IMG' &&
            (select as HTMLImageElement).name == 'avatar'
        ) {
            Object.keys(tags.value.menuDisplay).forEach(
                (name: string) => {
                    (tags.value.menuDisplay as any)[name] = false
                },
            )
            tags.value.menuDisplay.showRespond = false
            tags.value.menuDisplay.at = true
            tags.value.menuDisplay.poke = true
            tags.value.menuDisplay.remove = true
            if (
                chatStore.chatInfo.show.type != 'group' ||
                data.sender.user_id === authStore.loginInfo.uin ||
                chatStore.chatInfo.info.me_info.role === 'member' ||
                selectUserType == 'owner' ||
                (selectUserType == 'admin' && chatStore.chatInfo.info.me_info.role != 'owner')
            ) {
                tags.value.menuDisplay.remove = false
            }
            if (data.sender.user_id === authStore.loginInfo.uin) {
                tags.value.menuDisplay.at = false
            }
            if(chatStore.chatInfo.show.type == 'group' &&
            chatStore.chatInfo.info.me_info.role != 'member') {
                tags.value.menuDisplay.config = true
            }
        } else {
            if (
                data.sender.user_id === authStore.loginInfo.uin ||
                chatStore.chatInfo.info.me_info.role ===
                    'admin' ||
                chatStore.chatInfo.info.me_info.role === 'owner'
            ) {
                tags.value.menuDisplay.revoke = true
            }
            tags.value.menuDisplay.reedit = tags.value.menuDisplay.revoke && data.sender.user_id === authStore.loginInfo.uin
            if (data.revoke === true) {
                tags.value.menuDisplay.relpy = false
                tags.value.menuDisplay.forward = false
                tags.value.menuDisplay.revoke = false
                tags.value.menuDisplay.select = false
            }
            if (details.value[3].open) {
                Object.keys(tags.value.menuDisplay).forEach(
                    (name: string) => {
                        (tags.value.menuDisplay as any)[name] = false
                    },
                )
                tags.value.menuDisplay.jumpToMsg = true
            }
            const selection = document.getSelection()
            const textBody = selection?.anchorNode?.parentElement
            let textMsg = null as HTMLElement | null
            let msgParent = textBody
            if (msgParent) {
                while (msgParent.className != 'chat') {
                    if (
                        msgParent.className.startsWith('message') &&
                        msgParent.className.indexOf('-') < 0
                    ) {
                        textMsg = msgParent
                        break
                    }
                    msgParent =
                        msgParent.parentElement as HTMLDivElement
                    if (!msgParent) {
                        break
                    }
                }
            }
            if (
                textBody &&
                textBody.className.indexOf('msg-text') > -1 &&
                selection.focusNode == selection.anchorNode &&
                textMsg &&
                textMsg.id == data.message_id
            ) {
                selectCache.value = selection.toString()
                if (selectCache.value.length > 0) {
                    tags.value.menuDisplay.copySelect = true
                }
            }
            const nList = ['xml', 'json']
            data.message.forEach((item: any) => {
                if (nList.indexOf(item.type as string) > 0) {
                    tags.value.menuDisplay.forward = false
                    tags.value.menuDisplay.add = false
                }
            })
            if (isMessageImageTarget(select)) {
                tags.value.menuDisplay.downloadImg = (
                    select as HTMLImageElement
                ).src
            }
        }
        const pointX = event.x
        const pointY = event.y
        menu.style.marginLeft = pointX + 'px'
        menu.style.marginTop = pointY + 'px'
        let menuWidth = menu.clientWidth
        if (tags.value.menuDisplay.showRespond) {
            const item = menu.children[0] as HTMLDivElement
            menuWidth = item.clientWidth
        }
        const maxWidth = window.innerWidth
        if (pointX + menuWidth > maxWidth + 27) {
            menu.style.marginLeft = maxWidth + 7 - menuWidth + 'px'
        }
        tags.value.showMsgMenu = true
        setTimeout(() => {
            const menuHeight = menu.clientHeight
            const bodyHeight = document.body.clientHeight
            if (pointY + menuHeight > bodyHeight - 20) {
                menu.classList.add('topOut')
                menu.style.marginTop =
                    bodyHeight - menuHeight - 10 + 'px'
            }
        }, 100)
    }
}

function initMenuDisplay() {
    tags.value.menuDisplay = {
        menuSelectedMsgId : null,
        jumpToMsg: false,
        add: true,
        relpy: true,
        askBot: true,
        forward: true,
        select: true,
        copy: true,
        copySelect: false,
        downloadImg: false,
        copyImg: false,
        revoke: false,
        reedit: false,
        at: false,
        poke: false,
        remove: false,
        respond: false,
        showRespond: true,
        config: false,
    }
}

function menuReplyMsg(closeMenu = true) {
    const msgData = selectedMsg.value
    if (!msgData) return
    replyMsg(msgData)
    if (closeMenu) {
        closeMsgMenu()
    }
}

function generateSuggestFromMenu() {
    const msgData = selectedMsg.value
    closeMsgMenu()
    if (!msgData || profileOnly) return
    const messageId = String(msgData.message_id || '')
    if (!messageId) return
    void suggest.requestSuggest({
        lastMessageId: messageId,
        trigger: 'menu',
        messages: conversationSuggestMessages(),
    })
}

function replyMsg(msgData: any) {
    const msgId = msgData.message_id
    selectedMsg.value = msgData
    addSpecialMsg({
        msgObj: { type: 'reply', id: String(msgId) },
        addText: false,
        addTop: true,
    })
    tags.value.isReply = true
    toMainInput()
}

function cancelReply() {
    sendCache.value = sendCache.value.filter((item) => {
        return item.type !== 'reply'
    })
    tags.value.isReply = false
}

function consoleLogMsg() {
    if (!selectedMsg.value) return
    // eslint-disable-next-line no-console
    console.log(selectedMsg.value)
    closeMsgMenu()
}

function cancelForward() {
    forwardList.value = contactStore.userList
    tags.value.showForwardPan = false
    selectedForwardAction.value = 'single-message'
    closeMsgMenu()
}

function searchForward(event: Event) {
    const value = (event.target as HTMLInputElement).value
    forwardList.value = contactStore.userList.filter(
        (item: UserFriendElem & UserGroupElem) => {
            const name = (
                item.user_id? item.nickname + item.remark: item.group_name
            ).toLowerCase()
            const id = item.user_id ? item.user_id : item.group_id
            return (
                name.indexOf(value.toLowerCase()) !== -1 ||
                id.toString() === value
            )
        },
    )
}

function onViewerForward(event: Event) {
    const payload = (event as CustomEvent).detail
    const msg = payload?.message ?? payload
    if (!msg) return
    if (payload?.scope && !isChatScopeCurrent(payload.scope)) return
    selectedMsg.value = msg
    showForWard()
}

function onViewerDelete(event: Event) {
    const payload = (event as CustomEvent).detail
    const msg = payload?.message ?? payload
    if (!msg) return
    if (payload?.scope && !isChatScopeCurrent(payload.scope)) return
    selectedMsg.value = msg
    void revokeMsg()
}

async function onViewerEditSend(event: Event) {
    const payload = (event as CustomEvent).detail
    const dataurl = payload?.dataurl ?? payload
    if (!dataurl || typeof dataurl !== 'string') return
    const scope = payload?.scope ?? captureChatScope()
    if (!isChatScopeCurrent(scope)) return
    const file = dataUrlToFile(dataurl)
    await setImg(file, scope)
    if (!isChatScopeCurrent(scope)) return
    sendMsg('sendMsgBack', scope)
}

function dataUrlToFile(dataurl: string, name = 'image.png') {
    const arr = dataurl.split(',')
    const mime = /:(.*?);/.exec(arr[0])?.[1] || 'image/png'
    const bstr = atob(arr[1] || '')
    let n = bstr.length
    const u8 = new Uint8Array(n)
    while (n--) u8[n] = bstr.charCodeAt(n)
    return new File([u8], name, { type: mime })
}

function showForWard(action: ForwardAction = 'single-message') {
    selectedForwardAction.value = action
    tags.value.showForwardPan = true
    forwardList.value = prioritizeForwardContacts(
        contactStore.userList,
        [...contactStore.onMsgList].reverse(),
    )
    closeMsgMenu()
}

function forwardSelf() {
    const scope = captureChatScope()
    if (!isChatScopeCurrent(scope)) return
    if (selectedMsg.value) {
        const msgData = JSON.parse(JSON.stringify(selectedMsg.value))
        sendMsgRaw(
            chat.show.id,
            chat.show.type,
            msgData.message,
            true,
        )
    }
    closeMsgMenu()
}

function intoMultipleSelect() {
    if (selectedMsg.value) {
        multipleSelectList.value.push(selectedMsg.value.message_id)
    }
    profilePop.value = null
    chihiroPlusOpen.value = false
    details.value[1].open = false
    closeMsgMenu()
}

function closeProfilePop() {
    profilePop.value = null
}

function openProfilePop(payload: {
    userId: number
    nickname?: string
    card?: string
    anchor: {
        top: number
        left: number
        right: number
        bottom: number
        width: number
        height: number
    }
}) {
    if (multipleSelectList.value.length > 0) return
    profilePop.value = payload
}

function exitMultipleSelect() {
    multipleSelectList.value = []
}

function cloneMessagePayload<T>(payload: T): T {
    const rawPayload = toRaw(payload)
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(rawPayload)
        } catch {
            return JSON.parse(JSON.stringify(rawPayload))
        }
    }
    return JSON.parse(JSON.stringify(rawPayload))
}

function forwardMsg(data: UserFriendElem & UserGroupElem) {
    const sourceScope = captureChatScope()
    const forwardAction = selectedForwardAction.value
    const msgData = selectedMsg.value ? cloneMessagePayload(selectedMsg.value) : null
    const id = data.group_id ? data.group_id : data.user_id
    const targetId = String(id)
    const targetType = data.group_id ? 'group' : 'user'
    const msgList = chatStore.messageList.filter((item) => {
        return multipleSelectList.value.includes(item.message_id)
    })
    const shouldPreShow = () =>
        String(chat.show.id) === targetId && chat.show.type === targetType

    if (forwardAction !== 'single-message' && msgList.length === 0) {
        cancelForward()
        return
    }

    if (forwardAction === 'individual-messages') {
        const popInfo = {
            title: $t('逐条转发'),
            html: $t('将按顺序逐条转发 {count} 条消息，是否继续？', {
                count: msgList.length,
            }),
            button: [
                {
                    text: $t('取消'),
                    fun: () => {
                        uiStore.popBoxList.shift()
                    },
                },
                {
                    text: $t('确定'),
                    master: true,
                    fun: () => {
                        if (!isChatScopeCurrent(sourceScope)) {
                            uiStore.popBoxList.shift()
                            return
                        }
                        msgList.forEach((item) => {
                            sendMsgRaw(
                                targetId,
                                targetType,
                                cloneMessagePayload(item.message),
                                shouldPreShow(),
                            )
                        })
                        multipleSelectList.value = []
                        uiStore.popBoxList.shift()
                    },
                },
            ],
        }
        uiStore.popBoxList.push(popInfo)
    } else if (forwardAction === 'merged-messages') {
        const jsonMsg = {
            app: 'com.tencent.multimsg',
            meta: {
                detail: {
                    source: $t('合并转发消息'),
                    news: [
                        ...msgList.slice(0, 3).map((item) => {
                            const name =
                                item.sender.card &&
                                item.sender.card != ''? item.sender.card: item.sender.nickname
                            return {
                                text:
                                    name +
                                    ': ' +
                                    getMsgRawTxt(item),
                            }
                        }),
                    ],
                    summary: $t('查看 {count} 条转发消息', { count: msgList.length }),
                    resid: '',
                },
            },
        }
        const previewMsg = {
            message: [
                { type: 'json', data: JSON.stringify(jsonMsg), id: '' },
            ],
            sender: {
                user_id: authStore.loginInfo.uin,
                nickname: authStore.loginInfo.nickname,
            }
        }
        const popInfo = {
            title: $t('合并转发消息'),
            template: markRaw(MsgBody),
            templateValue: markRaw({ data: previewMsg, type: 'forward' }),
            button: [
                {
                    text: $t('取消'),
                    fun: () => {
                        uiStore.popBoxList.shift()
                    },
                },
                {
                    text: $t('确定'),
                    master: true,
                    fun: () => {
                        if (!isChatScopeCurrent(sourceScope)) {
                            uiStore.popBoxList.shift()
                            return
                        }
                        const msgBody = msgList.map((item) => {
                            return {
                                type: 'node',
                                id: item.message_id,
                                user_id: item.sender.user_id,
                                nickname: item.sender.nickname,
                                content: cloneMessagePayload(item.message),
                            }
                        })
                        sendMsgRaw(
                            targetId,
                            targetType,
                            msgBody,
                            shouldPreShow(),
                        )
                        multipleSelectList.value = []
                        uiStore.popBoxList.shift()
                    },
                },
            ],
        }
        uiStore.popBoxList.push(popInfo)
    } else if (selectedMsg.value && msgData) {
        const popInfo = {
            title: $t('转发消息'),
            template: markRaw(MsgBody),
            templateValue: markRaw({ data: msgData, type: 'forward' }),
            button: [
                {
                    text: $t('取消'),
                    fun: () => {
                        uiStore.popBoxList.shift()
                    },
                },
                {
                    text: $t('确定'),
                    master: true,
                    fun: () => {
                        if (!isChatScopeCurrent(sourceScope)) {
                            uiStore.popBoxList.shift()
                            return
                        }
                        sendMsgRaw(
                            targetId,
                            targetType,
                            cloneMessagePayload(msgData.message),
                            shouldPreShow(),
                        )
                        uiStore.popBoxList.shift()
                    },
                },
            ],
        }
        uiStore.popBoxList.push(popInfo)
    }
    cancelForward()
    if(contactStore.baseOnMsgList.get(id) == undefined) {
        contactStore.baseOnMsgList.set(id, data)
    }
    nextTick(() => {
        const user = document.getElementById('user-' + id)
        if (user) {
            user.click()
        }
    })
}

function sendRespond(num: number) {
    const msgData = selectedMsg.value
    if (msgData !== null) {
        const msgId = msgData.message_id
        Connector.send(
            authStore.jsonMap.send_respond.name,
            {
                group_id: chat.show.id,
                message_id: msgId,
                emoji_id: String(num),
                code: String(num),
            },
            'SendRespondBack_' + msgId + '_' + num,
        )
    }
    closeMsgMenu()
}

function isMessageImageTarget(el: HTMLElement | null) {
    if (!el || el.nodeName !== 'IMG') return false
    if ((el as HTMLImageElement).name === 'avatar') return false
    if (el.classList.contains('emoji-face')) return false
    return (el as HTMLImageElement).src.length > 0
}

async function copyMsg() {
    const imgUrl = tags.value.menuDisplay.downloadImg
    if (typeof imgUrl === 'string' && imgUrl) {
        await copyImg()
        return
    }
    const msgData = selectedMsg.value
    closeMsgMenu()
    if (!msgData) return
    const popInfo = new PopInfo()
    try {
        await copyBubbleContent(msgData)
        popInfo.add(PopType.INFO, $t('复制成功'), true)
    } catch (e) {
        popInfo.add(PopType.ERR, $t('复制失败'), true)
        new Logger().error(e as unknown as Error, '复制消息失败')
    }
}

function copySelectMsg() {
    if (selectCache.value != '') {
        const popInfo = new PopInfo()
        app.config.globalProperties
            .$copyText(selectCache.value)
            .then(
                () => {
                    popInfo.add(PopType.INFO, $t('复制成功'), true)
                },
                () => {
                    popInfo.add(PopType.ERR, $t('复制失败'), true)
                },
            )
    }
    closeMsgMenu()
}

async function copyImg() {
    const url = tags.value.menuDisplay.downloadImg
    if (!url) return
    closeMsgMenu()
    const popInfo = new PopInfo()
    try {
        await copyImageUrl(url)
        popInfo.add(PopType.INFO, $t('复制成功'))
    } catch (e) {
        popInfo.add(PopType.ERR, $t('复制失败'))
        new Logger().error(e as unknown as Error, '复制图片失败')
    }
}

function downloadImg() {
    const url = tags.value.menuDisplay.downloadImg
    if (url != false) {
        downloadFile(url as string, `img_${new Date().getTime()}.png`, () => undefined, () => undefined)
    }
    closeMsgMenu()
}

async function revokeMsg() {
    const scope = captureChatScope()
    const msgData = selectedMsg.value
    closeMsgMenu()
    if (!msgData) {
        new PopInfo().add(PopType.ERR, $t('获取选中消息失败'))
        return
    }
    const msgId = msgData.message_id
    if (!isChatScopeCurrent(scope)) return
    await Connector.callApi('delete_msg', { message_id: msgId })
    if (!isChatScopeCurrent(scope)) return
}

async function reeditMsg() {
    const scope = captureChatScope()
    const msgData = selectedMsg.value
    closeMsgMenu()
    if (!msgData) {
        new PopInfo().add(PopType.ERR, $t('获取选中消息失败'))
        return
    }
    const msgId = msgData.message_id
    if (!isChatScopeCurrent(scope)) return
    await Connector.callApi('delete_msg', { message_id: msgId })
    if (!isChatScopeCurrent(scope)) return
    reedit(msgData)
}

function removeUser() {
    const msgData = selectedMsg.value
    if (msgData !== null) {
        const popInfo = {
            title: $t('提醒'),
            html: `<span>${$t('真的要将 {user} 移出群聊吗', { user: msgData.sender.nickname })}</span>`,
            button: [
                {
                    text: $t('确定'),
                    fun: () => {
                        if (msgData) {
                            Connector.send(
                                'set_group_kick',
                                {
                                    group_id:
                                                    chatStore.chatInfo.show
                                                        .id,
                                    user_id: msgData.sender.user_id,
                                },
                                'setGroupKick',
                            )
                            closeMsgMenu()
                            uiStore.popBoxList.shift()
                        }
                    },
                },
                {
                    text: $t('取消'),
                    master: true,
                    fun: () => {
                        uiStore.popBoxList.shift()
                    },
                },
            ],
        }
        uiStore.popBoxList.push(popInfo)
    }
}

function closeMsgMenu() {
    const scope = captureChatScope()
    tags.value.showMsgMenu = false
    tags.value.menuDisplay.menuSelectedMsgId = null
    setTimeout(() => {
        if (!isChatScopeCurrent(scope)) return
        initMenuDisplay()
    }, 300)
}

function onProfileStartChat() {
    if (profileOnly) emit('startChat')
    else if (tags.value.openChatInfo) openChatInfoPan()
}

function openChatInfoPan() {
    tags.value.openChatInfo = !tags.value.openChatInfo
    if (tags.value.openChatInfo) {
        if (
            chat.show.type === 'group' &&
            chat.info.group_info.gc !== chat.show.id
        ) {
            const url = `https://qinfo.clt.qq.com/cgi-bin/qun_info/get_group_info_all?gc=${chat.show.id}&bkn=${authStore.loginInfo.bkn}`
            Connector.send(
                'http_proxy',
                { url: url },
                'getMoreGroupInfo',
            )
        } else if (
            chat.show.type === 'user' &&
            chat.info.user_info.uin !== chat.show.id
        ) {
            const userInfo = authStore.jsonMap.friend_info.name
            if(userInfo != undefined) {
                Connector.send(
                    userInfo,
                    { user_id: chat.show.id },
                    'getMoreUserInfo',
                )
            }
        }
        const noticeName = authStore.jsonMap.group_notices.name
        if (
            chat.show.type === 'group' &&
            (chat.info.group_notices === undefined ||
                Object.keys(chat.info.group_notices).length ===
                    0)
        ) {
            if (noticeName) {
                Connector.send(
                    noticeName,
                    { group_id: chat.show.id },
                    'getGroupNotices',
                )
            }
        }
        if (chat.show.type === 'group' && Object.keys(chat.info.group_files).length === 0) {
            const name = authStore.jsonMap.group_files?.name
            if(name) {
                Connector.send(name, {
                    group_id: chat.show.id
                }, 'getGroupFiles')
            }
        }
    }
}

function mutateImgCache(mut: (map: Map<number, string>) => void) {
    const next = new Map(imgCache.value)
    mut(next)
    imgCache.value = next
}

function nextCacheKey(map: { size: number, keys: () => IterableIterator<number> }) {
    return map.size === 0 ? 0 : Math.max(...map.keys()) + 1
}

function addAttachSrc(src: string) {
    const value = src?.trim()
    if (!value) return
    mutateImgCache((map) => {
        map.set(nextCacheKey(map), value)
    })
}

function stickerSrcFromFile(file: string) {
    const value = file?.trim()
    if (!value) return ''
    if (value.startsWith('base64://')) return 'data:image/png;base64,' + value.slice(9)
    return value
}

function insertTextAtCursor(text: string) {
    if (!text) return
    if (composer.value?.insertText) {
        composer.value.insertText(text)
        return
    }
    msg.value += text
}

function insertFaceAtCursor(id: number) {
    if (composer.value?.insertFace) {
        composer.value.insertFace(id)
        return
    }
    insertTextAtCursor(Emoji.get(id)?.value || '')
}

function atDisplayName(qq: number | string, sender?: { card?: string, nickname?: string } | null) {
    const fromSender = sender?.card?.trim() || sender?.nickname?.trim()
    if (fromSender) return fromSender
    const members = chatStore.chatInfo.info.group_members
    const user = members?.find((item) => item.user_id == Number(qq))
    if (user) {
        const name = user.card && user.card !== '' ? user.card : user.nickname
        if (name) return name
    }
    return String(qq)
}

function insertAtAtCursor(qq: number | string, name?: string) {
    const label = (name || atDisplayName(qq)).replace(/^@/, '')
    if (composer.value?.insertAt) {
        composer.value.insertAt(qq, label)
        return
    }
    insertTextAtCursor('@' + label + ' ')
}

function hasOutgoingContent() {
    return hasComposerContent({
        text: msg.value,
        attachmentCount: imgCache.value.size,
        hasInlineFaces: !!composer.value?.hasInlineFaces?.(),
        hasInlineAts: !!composer.value?.hasInlineAts?.(),
    })
}

function imageSegFromSrc(src: string) {
    if (src.startsWith('data:') && src.includes('base64,')) {
        return {
            type: 'image',
            file: 'base64://' + src.substring(src.indexOf('base64,') + 7),
        }
    }
    return { type: 'image', file: src }
}

function decodeHtmlEntities(text: string) {
    if (!text || !text.includes('&')) return text
    const box = document.createElement('textarea')
    box.innerHTML = text
    return box.value
}

function parseCqParams(body: string) {
    const out: Record<string, string> = {}
    for (const part of body.split(',')) {
        const eq = part.indexOf('=')
        if (eq <= 0) continue
        out[part.slice(0, eq).trim()] = decodeHtmlEntities(part.slice(eq + 1).trim())
    }
    return out
}

function cqImageSrc(params: string) {
    const info = parseCqParams(params)
    const url = info.url || info.file || ''
    if (/^https?:\/\//i.test(url) || url.startsWith('data:image/')) return url
    return ''
}

function extractCqImageSrcs(text: string) {
    const srcs: string[] = []
    const re = /\[CQ:image,([^\]]*)\]/gi
    let match: RegExpExecArray | null
    while ((match = re.exec(text)) !== null) {
        const src = cqImageSrc(match[1] || '')
        if (src) srcs.push(src)
    }
    return srcs
}

function extractHtmlImageSrcs(html: string) {
    const srcs: string[] = []
    const re = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi
    let match: RegExpExecArray | null
    while ((match = re.exec(html)) !== null) {
        const src = decodeHtmlEntities(match[1] || match[2] || match[3] || '').trim()
        if (/^(https?:\/\/|data:image\/|blob:)/i.test(src)) srcs.push(src)
    }
    return srcs
}

function stripCqImages(text: string) {
    return text.replace(/\[CQ:image,[^\]]*\]/gi, '')
}

function escapeHtml(text: string) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

function escapeAttr(text: string) {
    return escapeHtml(text).replace(/"/g, '&quot;')
}

function bubbleCopyParts(msgData: any) {
    let plain = ''
    let html = ''
    const urls: string[] = []
    const segs = Array.isArray(msgData?.message) ? msgData.message : []
    for (const seg of segs) {
        if (!seg || typeof seg !== 'object') continue
        if (seg.type === 'text' && typeof seg.text === 'string') {
            plain += seg.text
            html += escapeHtml(seg.text).replace(/\n/g, '<br>')
        } else if (seg.type === 'at') {
            const name = String(seg.text || seg.qq || '')
            const piece = name ? '@' + name : ''
            plain += piece
            html += escapeHtml(piece)
        } else if (seg.type === 'face') {
            const emoji = Emoji.get(Number(seg.id))
            const piece = emoji?.type === 'emoji'
                ? emoji.value
                : (emoji?.description ? '[' + emoji.description + ']' : '[' + $t('表情') + ']')
            plain += piece
            html += escapeHtml(piece)
        } else if (seg.type === 'image' || seg.type === 'mface') {
            const url = String(seg.url || '')
            if (!url) continue
            urls.push(url)
            html += '<img src="' + escapeAttr(url) + '">'
        }
    }
    return { plain, html, urls }
}

async function copyBubbleContent(msgData: any) {
    const parts = bubbleCopyParts(msgData)
    if (parts.urls.length === 1 && parts.plain.trim() === '') {
        await copyImageUrl(parts.urls[0])
        return
    }
    if (parts.urls.length === 0) {
        const text = parts.plain || getMsgRawTxt(msgData) || ''
        await copyToClipboard(text)
        return
    }
    const html = '<div data-chihiro-copy="1">' + parts.html + '</div>'
    await copyToClipboard([
        new ClipboardItem({
            'text/plain': new Blob([parts.plain], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
        }),
    ])
}

function imageCopySources(url: string) {
    if (!url) return []
    if (url.startsWith('data:') || url.startsWith('blob:')) return [url]
    const real = backend.unProxyUrl(url)
    const sources: string[] = []
    sources.push('/api/runtime/image-proxy?url=' + encodeURIComponent(real))
    const proxied = backend.proxyUrl(real)
    if (proxied !== real) sources.push(proxied)
    return sources
}

async function copyImageUrl(url: string) {
    let lastError: unknown
    for (const src of imageCopySources(url)) {
        try {
            const data = await getImageUrlData(src)
            if (backend.type === 'tauri') {
                const Clipboard = await import('@tauri-apps/plugin-clipboard-manager')
                await Clipboard.writeImage(data.buffer)
                return
            }
            await copyToClipboard([new ClipboardItem({ [data.blob.type]: data.blob })])
            return
        } catch (e) {
            lastError = e
        }
    }
    throw lastError instanceof Error ? lastError : new Error('图片加载失败')
}

function consumeCqImagesFromMsg() {
    if (!/\[CQ:image,/i.test(msg.value)) return false
    const srcs = extractCqImageSrcs(msg.value)
    if (srcs.length === 0) return false
    srcs.forEach(addAttachSrc)
    msg.value = stripCqImages(msg.value)
    return true
}

function deleteImg(index: number) {
    mutateImgCache((map) => { map.delete(index) })
    msg.value = msg.value.replace(
        '[SQ:' + index + ']',
        '',
    )
    msg.value = msg.value.replace(
        '[SQ:' + index,
        '',
    )
}

async function editImg(key: number) {
    const img = imgCache.value.get(key)
    if (!img) return
    if (!viewerRef?.value) return
    const scope = captureChatScope()
    const dataurl = await viewerRef.value.edit(img, scope)
    if (!isChatScopeCurrent(scope)) return
    mutateImgCache((map) => { map.set(key, dataurl) })
}

function addSpecialMsg(data: SQCodeElem) {
    if (data !== undefined) {
        if (data.msgObj?.type === 'at' && data.addText) {
            const qq = data.msgObj.qq
            const raw = typeof data.msgObj.text === 'string' ? data.msgObj.text : ''
            insertAtAtCursor(qq, raw.replace(/^@/, '') || atDisplayName(qq, selectedMsg.value?.sender))
            return -1
        }
        const index = sendCache.value.length
        sendCache.value.push(data.msgObj)
        if (!data.addText) return index

        const sqCode = `[SQ:${index}]`
        if (data.addTop === true) {
            const current = composer.value?.getPlainText?.() ?? msg.value
            if (composer.value?.clear && composer.value?.insertText) {
                composer.value.clear()
                composer.value.insertText(sqCode + current)
            } else {
                msg.value = sqCode + msg.value
            }
        } else if (composer.value?.insertText) {
            composer.value.insertText(sqCode)
        } else {
            msg.value += sqCode
        }
        return index
    }
    return -1
}

function addImg(event: ClipboardEvent) {
    const data = event.clipboardData
    if (!data) return

    const imageFiles: File[] = []
    if (data.items) {
        for (let i = 0; i < data.items.length; i++) {
            const item = data.items[i]
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile()
                if (file) imageFiles.push(file)
            }
        }
    }
    if (imageFiles.length === 0 && data.files) {
        for (let i = 0; i < data.files.length; i++) {
            const file = data.files[i]
            if (file.type.startsWith('image/')) imageFiles.push(file)
        }
    }
    if (imageFiles.length > 0) {
        event.preventDefault()
        imageFiles.forEach((file) => { void setImg(file) })
        return
    }

    const html = decodeHtmlEntities(data.getData('text/html') || '')
    const plain = decodeHtmlEntities(data.getData('text/plain') || '')
    const srcs = extractCqImageSrcs(plain)
        .concat(extractCqImageSrcs(html))
        .concat(extractHtmlImageSrcs(html))
    const unique = [...new Set(srcs)]
    if (unique.length > 0) {
        event.preventDefault()
        unique.forEach(addAttachSrc)
        const leftover = stripCqImages(plain).trim()
        if (leftover) insertTextAtCursor(leftover)
    }
}

function runSelectImg() {
    const input = document.getElementById('choice-pic')
    if (input) {
        input.click()
    }
}

function selectImg(event: Event) {
    tags.value.showMoreDetail = false
    const sender = event.target as HTMLInputElement
    if (sender && sender.files) {
        setImg(sender.files[0])
    }
}

function runSelectFile() {
    const input = document.getElementById('choice-file')
    if (input) {
        input.click()
    }
}

function selectFile(event: Event) {
    tags.value.showMoreDetail = false
    const sender = event.target as HTMLInputElement
    if (sender.files != null) {
        const file = sender.files[0]
        const fileName = file.name
        const size = file.size
        if (size > 1073741824) {
            const popInfo = {
                title: $t('提醒'),
                html: `<span>${$t('文件大于 1GB。发送速度可能会非常缓慢；确认要发送吗？')}</span>`,
                button: [
                    {
                        text: $t('发送'),
                        fun: () => {
                            uiStore.popBoxList.shift()
                        },
                    },
                    {
                        text: $t('取消'),
                        master: true,
                        fun: () => {
                            uiStore.popBoxList.shift()
                        },
                    },
                ],
            }
            uiStore.popBoxList.push(popInfo)
        } else {
            sendFile(file, fileName)
        }
        sender.value = ''
    }
}

function sendFile(file: File, fileName: string | null) {
    const scope = captureChatScope()
    const displayName = fileName ?? file.name ?? $t('未知文件')
    const taskId = addUploadTask({
        fileName: displayName,
        fileSize: file.size,
        execute: (onProgress) => {
            const reader = new FileReader()
            reader.onprogress = (event) => {
                if (event.lengthComputable) {
                    if (isChatScopeCurrent(scope)) {
                        onProgress(event.loaded, event.total)
                    } else {
                        cancelUploadTask(taskId)
                    }
                }
            }
            reader.readAsDataURL(file)
            reader.onloadend = () => {
                if (!isChatScopeCurrent(scope)) {
                    cancelUploadTask(taskId)
                    return
                }
                let base64data = reader.result as string
                base64data = base64data.substring(
                    base64data.indexOf('base64,') + 7,
                    base64data.length,
                )
                sendCache.value = []
                imgCache.value = new Map()
                composer.value?.clear?.()
                msg.value = ''
                addSpecialMsg({
                    addText: true,
                    msgObj: {
                        type: 'file',
                        file: 'base64://' + base64data,
                        name: displayName,
                    },
                })
                sendMsg('sendFileBack_' + taskId)
            }
            reader.onerror = () => {
                if (isChatScopeCurrent(scope)) {
                    failUploadTask(taskId, '文件读取失败')
                } else {
                    cancelUploadTask(taskId)
                }
            }
        }
    })
}

async function setImg(file: File | null, scope = captureChatScope()) {
    const popInfo = new PopInfo()
    if (!file) return
    if (!file.type.includes('image/')) return
    if (file.size === 0) return

    if (file.size > 3145728) {
        const options = { maxSizeMB: 3, useWebWorker: true }
        try {
            popInfo.add(PopType.INFO, $t('正在压缩图片 ……'))
            const compressedFile = await imageCompression(file, options)
            if (!isChatScopeCurrent(scope)) return
            new Logger().add(
                LogType.INFO,
                '图片压缩成功，原大小：' +
                    file.size / 1024 / 1024 +
                    ' MB，压缩后大小：' +
                    compressedFile.size / 1024 / 1024 +
                    ' MB',
            )
            await setImg(compressedFile, scope)
        } catch (error) {
            new Logger().error(error as Error, '图片压缩失败')
            popInfo.add(PopType.INFO, $t('压缩图片失败'))
        }
        return
    }

    const dataurl = await fileToDataURL(file)
    if (!isChatScopeCurrent(scope)) return
    addAttachSrc(dataurl)
}

async function fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = function(event) {
            if (!event.target) reject(new Error('读取文件失败'))
            else resolve(event.target.result as string)
        }
        reader.onerror = function(error) {
            reject(error)
        }
        reader.readAsDataURL(file)
    })
}

function toMainInput() {
    const input = (document.getElementById( 'main-input') as HTMLTextAreaElement | HTMLInputElement) ??
        (document.getElementById( 'main-input-ex') as HTMLTextAreaElement | HTMLInputElement)
    if (input !== null) {
        input.focus()
    }
}

function plusOneMsg(msg: any) {
    const segs = plusOneSendSegments(msg)
    if (!segs?.length) return
    if (chat.show.temp) {
        sendMsgRaw(
            chat.show.id + '/' + chat.show.temp,
            chat.show.type,
            segs,
            true,
        )
    } else {
        sendMsgRaw(
            chat.show.id,
            chat.show.type,
            segs,
            true,
        )
    }
    scrollBottom()
}

function sendMsg(echo = 'sendMsgBack', scope?: NativeAsyncScope) {
    if (scope && !isChatScopeCurrent(scope)) return
    if (details.value[3].open) {
        return
    }
    details.value.forEach((item) => {
        item.open = false
    })

    const cache = sendCache.value
    let text = composer.value?.serialize?.(cache) ?? msg.value
    const attachStart = cache.length
    for (const src of imgCache.value.values()) {
        cache.push(imageSegFromSrc(src))
    }
    if (imgCache.value.size > 0) {
        let prefix = ''
        for (let i = 0; i < imgCache.value.size; i++) {
            prefix += `[SQ:${attachStart + i}]`
        }
        text = prefix + text
    }
    const parsedMsg = SendUtil.parseMsg(
        text,
        cache,
        [],
    )
    if (chat.show.temp) {
        sendMsgRaw(
            chat.show.id + '/' + chat.show.temp,
            chat.show.type,
            parsedMsg,
            true,
            echo,
        )
    } else {
        sendMsgRaw(
            chat.show.id,
            chat.show.type,
            parsedMsg,
            true,
            echo,
        )
    }
    tags.value.checkNewLineFlag = true
    msg.value = ''
    sendCache.value = []
    imgCache.value = new Map()
    composer.value?.clear?.()
    scrollBottom()
    cancelReply()
    scheduleResizeMainInput(undefined, true)
}

function updateList(newLength: number, oldLength: number) {
    if (profileOnly) return
    if (oldLength == 0 && newLength > 0) {
        const name =
            authStore.jsonMap.set_message_read?.name ?? undefined
        let private_name =
            authStore.jsonMap.set_message_read?.private_name ??
            name
        if (!private_name) private_name = name
        if (chatStore.chatInfo.show.type == 'group') {
            Connector.send(
                name,
                {
                    group_id: chat.show.id,
                    message_id:
                        list[list.length - 1].message_id,
                },
                'setMessageRead',
            )
        } else {
            Connector.send(
                private_name,
                {
                    user_id: chat.show.id,
                    message_id:
                        list[list.length - 1].message_id,
                },
                'setMessageRead',
            )
        }
        if(shouldAutoFocus()) {
            toMainInput()
        }
    }

    if (
        list.length > 200 &&
        !uiStore.nowGetHistory &&
        followingBottom
    ) {
        chatStore.messageList = []
        const info = {
            type: chat.show.type,
            id: chat.show.id,
            name: chat.show.name,
            avatar: chat.show.avatar,
            jump: chat.show.jump,
        } as BaseChatInfoElem
        loadHistoryFirst(info)
        uiStore.nowGetHistory = true
    }

    const pan = document.getElementById('msgPan')
    if (pan !== null) {
        const height = pan.scrollHeight
        nextTick(() => {
            const newPan = document.getElementById('msgPan')
            if (newPan !== null) {
                if (uiStore.nowGetHistory) {
                    scrollTo(
                        newPan.scrollHeight - height,
                        false,
                    )
                }
                if (!uiStore.nowGetHistory) {
                    if (followingBottom) {
                        scrollTo(newPan.scrollHeight)
                    } else if (oldLength > 0 && newLength > oldLength) {
                        const added = countIncomingTail(
                            list,
                            oldLength,
                            authStore.loginInfo.uin,
                        )
                        if (added > 0) {
                            latestBelowCount.value += added
                            if (!settlingToBottom) tags.value.showBottomButton = true
                        }
                    }
                    if (oldLength <= 0) {
                        followingBottom = true
                        latestBelowCount.value = 0
                        tags.value.showBottomButton = false
                        scrollTo(newPan.scrollHeight, false)
                        nextTick(() => refreshUnreadHint())
                    }
                }
                uiStore.nowGetHistory = false
            }

            const getImgList = () => {
                const getImgList = [] as string[]
                for(const item of list) {
                    if (item.message !== undefined) {
                        for(const msgItem of item.message) {
                            if (
                                msgItem.type === 'image' &&
                                msgItem.file != 'marketface'
                            ) {
                                getImgList.push(msgItem.url)
                            }
                        }
                    }
                }
                return getImgList
            }
            chatImg.value = Img.fromList(getImgList())
            if (
                chatStore.chatInfo.show &&
                chatStore.chatInfo.show.jump
            ) {
                new Logger().debug(
                    '进入跳转至消息：' +
                        chatStore.chatInfo.show.jump,
                )
                scrollToMsgLocal(
                    'chat-' + chatStore.chatInfo.show.jump,
                )
                chatStore.chatInfo.show.jump = undefined
            }
        })
    }
}

function msgClick(_: Event, data: any) {
    const message_id = data.message_id
    if (multipleSelectList.value.length > 0) {
        if (multipleSelectList.value.indexOf(message_id) > -1) {
            multipleSelectList.value =
                multipleSelectList.value.filter((item) => {
                    return item != message_id
                })
        } else {
            multipleSelectList.value.push(message_id)
        }
    }
}

function delMsgs() {
    new PopInfo().add(
        PopType.INFO,
        $t('欸嘿，这个按钮只是用来占位置的'),
    )
}

function copyMsgs() {
    const msgList = list.filter((item: any) => {
        return multipleSelectList.value.indexOf(item.message_id) > -1
    })
    let msgText = ''
    let lastDate = ''
    msgList.forEach((item: any) => {
        const time = new Date(getViewTime(item.time))
        const date =
            time.getFullYear() +
            '-' +
            (time.getMonth() + 1) +
            '-' +
            time.getDate()
        if (date != lastDate) {
            msgText += '\n—— ' + date + ' ——\n'
            lastDate = date
        }
        msgText +=
            item.sender.nickname +
            ' ' +
            time.getHours() +
            ':' +
            time.getMinutes() +
            ':' +
            time.getSeconds() +
            '\n' +
            getMsgRawTxt(item) +
            '\n\n'
    })
    const popInfo = new PopInfo()
    app.config.globalProperties.$copyText(msgText).then(
        () => {
            popInfo.add(PopType.INFO, $t('复制成功'), true)
            multipleSelectList.value = []
        },
        () => {
            popInfo.add(PopType.ERR, $t('复制失败'), true)
        },
    )
}

async function recallMsgs() {
    const scope = captureChatScope()
    const msgList = list.filter((item: any) => multipleSelectList.value.includes(item.message_id))
    for (const msgItem of msgList) {
        if (!isChatScopeCurrent(scope)) return
        const msgId = msgItem.message_id
        await Connector.callApi('delete_msg', { message_id: msgId })
        if (!isChatScopeCurrent(scope)) return
    }
    multipleSelectList.value = []
}

function showJin() {
    details.value[2].open = !details.value[2].open
    if (chatStore.chatInfo.info.jin_info.list.length == 0) {
        const name =
            authStore.jsonMap.group_essence.name ??
            'get_essence_msg_list'
        Connector.send(
            name,
            {
                group_id: chat.show.id,
                pages: 0,
            },
            'getJin',
        )
    }
    tags.value.showMoreDetail = !tags.value.showMoreDetail
}

async function handleInput(event: Event) {
    const input = event.target as HTMLElement
    if (consumeCqImagesFromMsg()) {
        scheduleResizeMainInput(input)
        return
    }
    scheduleResizeMainInput(input)

    const diff = getDifferencesWithRanges(msg.value, oldMsg.value)
    let { end, str } = { end: 0, str: '' }
    if(diff.length > 0) {
        ({ end, str } = diff[0])
    }

    if(str.indexOf(']') >= 0) {
        const sqIndex = oldMsg.value.substring(0, end).lastIndexOf('[SQ:')
        if(sqIndex >= 0 && sqIndex < end) {
            const msgHas = oldMsg.value.substring(sqIndex)
            const sq = oldMsg.value.slice(sqIndex, msgHas.indexOf(']') + sqIndex + 1)
            const numStr = sq.replace('[SQ:', '').replace(']', '')
            const num = Number(numStr)
            if(!isNaN(num) && imgCache.value.has(num)) {
                deleteImg(num)
            }
        }
    }

    if (details.value[3].open) {
        if (searchDebounceTimer.value) {
            clearTimeout(searchDebounceTimer.value)
            searchDebounceTimer.value = null
        }
        const value = msg.value
        if (value.length == 0) {
            searchRequestId.value++
            tags.value.search.list = reactive(list)
        } else if (settingsStore.sysConfig.enable_local_history) {
            const requestId = ++searchRequestId.value
            const scope = captureChatScope()
            searchDebounceTimer.value = setTimeout(async () => {
                let results: any[] = []
                try {
                    results = await dbSearchMessages(
                        authStore.loginInfo.uin,
                        chatStore.chatInfo.show.id,
                        value,
                    )
                } catch {
                    return
                }
                if (
                    requestId !== searchRequestId.value ||
                    !details.value[3].open ||
                    !isChatScopeCurrent(scope)
                ) return
                tags.value.search.list = results
            }, 180)
        } else {
            searchRequestId.value++
            tags.value.search.list = list.filter(
                (item: any) => {
                    const rawMessage = getMsgRawTxt(item)
                    return rawMessage.indexOf(value) !== -1
                },
            )
        }
    }
}

function openSearch() {
    details.value[3].open = !details.value[3].open
    tags.value.showMoreDetail = !tags.value.showMoreDetail
}

function closeSearch() {
    if (searchDebounceTimer.value) {
        clearTimeout(searchDebounceTimer.value)
        searchDebounceTimer.value = null
    }
    searchRequestId.value++
    details.value[3].open = !details.value[3].open
    msg.value = ''
    tags.value.search.list = reactive(list)
    scheduleResizeMainInput()
}

function sendPoke(userId: number) {
    if (authStore.jsonMap.poke) {
        let name = authStore.jsonMap.poke.name
        if (
            chat.show.type == 'user' &&
            authStore.jsonMap.poke.private_name
        ) {
            name = authStore.jsonMap.poke.private_name
        }
        Connector.send(
            name,
            {
                user_id: userId,
                group_id: chat.show.id,
            },
            'sendPoke',
        )
    }
    tags.value.showMoreDetail = false
    tags.value.menuDisplay.poke = false
}

function reedit(msgData: any) {
    msg.value = ''
    sendCache.value = []
    imgCache.value = new Map()
    composer.value?.clear?.()
    cancelReply()
    for (const seg of msgData.message) {
        if (seg.type === 'text') {
            insertTextAtCursor(seg.text)
        } else if (seg.type === 'reply') {
            const foundMsg = list.find((item: any) => item.message_id == seg.id)
            if (!foundMsg) continue
            replyMsg(foundMsg)
        } else if (seg.type === 'image') {
            const url = String(seg.url || '')
            const file = String(seg.file || '')
            if (/^https?:\/\//i.test(url) || url.startsWith('data:')) addAttachSrc(url)
            else if (/^https?:\/\//i.test(file) || file.startsWith('data:')) addAttachSrc(file)
            else if (file.startsWith('base64://')) addAttachSrc('data:image/png;base64,' + file.slice(9))
        } else if (seg.type === 'face' && seg.id != null && !Number.isNaN(Number(seg.id))) {
            insertFaceAtCursor(Number(seg.id))
        } else if (seg.type === 'at') {
            const raw = typeof seg.text === 'string' ? seg.text : ''
            insertAtAtCursor(seg.qq, raw.replace(/^@/, '') || atDisplayName(seg.qq))
        } else {
            addSpecialMsg({
                addText: true,
                msgObj: seg,
            })
        }
    }
    toMainInput()
}

function jinScroll(event: Event) {
    const body = event.target as HTMLDivElement
    if (
        body.scrollTop + body.clientHeight === body.scrollHeight &&
        !tags.value.isJinLoading
    ) {
        if (chat.info.jin_info.is_end == false) {
            tags.value.isJinLoading = true
            const name =
                authStore.jsonMap.group_essence.name ??
                'get_essence_msg_list'
            Connector.send(
                name,
                {
                    group_id: chat.show.id,
                    pages: chat.info.jin_info.pages + 1,
                },
                'getJin',
            )
        }
    }
}

function viewerEssImg(url: string) {
    if (!viewerRef?.value) return
    viewerRef.value.open(new Img(url))
}

function moreFunClick(type = 'default') {
    let hasOpen = false
    details.value.forEach((item) => {
        if (item.open) hasOpen = true
        item.open = false
    })
    if (hasOpen) return
    if (tags.value.showMoreDetail) {
        tags.value.showMoreDetail = false
        return
    }
    switch(type) {
        case 'default': tags.value.showMoreDetail = true; break
        case 'img': runSelectImg(); break
        case 'file': runSelectFile(); break
        case 'face': details.value[1].open = !details.value[1].open; break
    }
}

function getTargetWin(): HTMLDivElement | undefined {
    const chatPan = document.getElementById('chat-pan')
    if (!chatPan) return
    if(tags.value.openChatInfo) {
        return chatPan.getElementsByClassName('chat-info-pan')[0] as HTMLDivElement
    } else if(mergePan.value?.isMergeOpen()) {
        return chatPan.getElementsByClassName('merge-pan')[0] as HTMLDivElement
    } else {
        return chatPan as HTMLDivElement
    }
}

function exitWin() {
    if (profileOnly) { emit('closeProfile'); return }
    if(tags.value.openChatInfo) {
        openChatInfoPan()
    } else if(mergePan.value?.isMergeOpen()) {
        mergePan.value?.closeMergeMsg()
        setTimeout(() => {
            const chatPan = document.getElementById('chat-pan')
            const mergePanEl = chatPan!.getElementsByClassName('merge-pan')[0] as HTMLDivElement
            if(mergePanEl) {
                mergePanEl.style.transform = ''
            }
        }, 500)
    } else {
        chatStore.chatInfo.show.id = 0
        uiStore.openSideBar = true
        new Logger().add(LogType.UI, '右滑打开侧边栏触发完成')
    }
}
</script>

<style scoped>
    .contact-profile-view > :not(.chat-info-pan):not(.contact-profile-actions) { display: none !important; }
    .contact-profile-view :deep(.chat-info-pan) {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        background: var(--color-bg) !important;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }
    .contact-profile-view:has(.contact-profile-actions) :deep(.chat-info-pan) {
        inset: 0 0 76px !important;
    }
    .contact-profile-view :deep(.chat-info) {
        position: relative !important;
        inset: auto !important;
        width: 100% !important;
        height: 100% !important;
        max-width: none !important;
        max-height: none !important;
        margin: 0 !important;
        transform: none !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        background: var(--color-bg) !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden;
    }
    .contact-profile-view :deep(.chat-info-tab) {
        flex: 1;
        min-height: 0;
    }
    .contact-profile-view :deep(.chihiro-friend-profile) {
        overflow: auto;
    }
    .contact-profile-actions {
        position: absolute;
        inset: auto 0 0;
        height: 76px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px 28px 16px;
        box-sizing: border-box;
        border-top: 1px solid rgba(127, 127, 127, 0.12);
        background: var(--color-bg);
    }
    .contact-profile-send {
        width: 100%;
        max-width: 420px;
        height: 44px;
        margin: 0;
        padding: 0 20px;
        border: 0;
        border-radius: 8px;
        background: var(--color-main);
        color: var(--color-font-r);
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
    }
    .contact-profile-send:hover {
        filter: brightness(1.06);
    }
    /* 消息动画 */
    .msglist-move {
        transition: all 0.3s;
    }

    .msglist-enter-active {
        transition: all 0.4s;
    }

    .msglist-leave-active {
        transition: all 0.2s;
    }

    .msglist-enter-from {
        transform: translateX(-20px);
        opacity: 0;
    }

    .msglist-leave-to {
        opacity: 0;
    }

    /* 更多功能面板动画 */
    .pan-enter-active,
    .pan-leave-active {
        transition: opacity 0.3s;
    }

    .pan-enter-from {
        transform: translateX(20px);
        opacity: 0;
    }

    .pan-leave-to {
        opacity: 0;
    }
</style>


<style>
.chat-pan > .chihiro-unread-hint {
    position: absolute;
    top: 64px;
    right: 16px;
    z-index: 8;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 32px;
    padding: 0 12px 0 10px;
    border: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-card-1) 82%, transparent);
    backdrop-filter: blur(18px);
    color: #4c9fff;
    font-size: 13px;
    line-height: 32px;
    cursor: pointer;
    pointer-events: all;
}
.chat-pan > .chihiro-unread-hint:hover {
    background: color-mix(in srgb, var(--color-card-1) 92%, transparent);
}
.chat-pan > .chihiro-unread-hint svg {
    display: block;
    flex: 0 0 auto;
}
.note:has(.note-time).msglist-enter-from,
.note:has(.note-time).msglist-enter-active {
    transform: none !important;
    opacity: 1 !important;
    transition: none !important;
}
.msg-menu {
    overflow: visible !important;
    pointer-events: none !important;
}
.msg-menu.is-open {
    position: fixed !important;
    inset: 0 !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    z-index: 1000 !important;
}
.msg-menu-bg {
    position: fixed !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    pointer-events: auto !important;
    z-index: 0;
}
.msg-menu-body {
    width: max-content !important;
    min-width: 0 !important;
    max-width: none !important;
    padding: 6px !important;
    position: relative;
    z-index: 1;
    pointer-events: auto;
}
.msg-menu-body > .respond {
    position: absolute !important;
    left: 0 !important;
    right: auto !important;
    bottom: calc(100% + 8px) !important;
    width: max-content !important;
    max-width: min(360px, calc(100vw - 24px)) !important;
    margin: 0 !important;
    overflow: hidden !important;
    flex-wrap: nowrap !important;
    height: 40px !important;
}
.msg-menu-body > .respond.open {
    height: auto !important;
    max-height: 132px !important;
    flex-wrap: wrap !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
}
.msg-menu-body > .respond.open > svg {
    display: none !important;
}
.msg-menu-body > div:not(.respond) {
    flex-direction: row !important;
    justify-content: flex-start !important;
    align-items: center !important;
    gap: 10px !important;
    width: max-content !important;
    min-width: 100% !important;
    padding: 7px 10px !important;
    box-sizing: border-box;
}
.msg-menu-body > div:not(.respond) > div {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex: 0 0 16px !important;
    width: 16px !important;
    height: 16px !important;
    margin: 0 !important;
}
.msg-menu-body > div:not(.respond) > div > svg {
    margin: 0 !important;
    width: 14px !important;
    height: 14px !important;
}
.msg-menu-body > div:not(.respond) > a {
    margin: 0 !important;
    flex: 0 0 auto;
    text-align: left;
    font-size: 13px !important;
    white-space: nowrap;
}

.chihiro-head-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    pointer-events: all;
    flex: 0 0 auto;
    margin-right: 0;
}
.chihiro-bot-wrap {
    position: relative;
}
.chihiro-bot-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 40;
    width: 280px;
    padding: 8px 12px;
    border: 1px solid var(--color-card-2);
    border-radius: 12px;
    background: var(--color-card);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);
    color: var(--color-font);
    font-size: 13px;
}
.chihiro-bot-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 40px;
}
.chihiro-bot-row > span {
    color: var(--color-font);
    flex: 0 0 auto;
}
.chihiro-bot-switch {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: 40px;
    min-width: 40px;
    height: 22px;
    margin: 0;
    cursor: pointer;
}
.chihiro-bot-switch input {
    position: absolute;
    inset: 0;
    z-index: 1;
    margin: 0;
    opacity: 0;
    cursor: pointer;
    appearance: none;
    display: block !important;
}
.chihiro-bot-switch > div {
    position: relative;
    width: 40px;
    height: 22px;
    border-radius: 11px;
    background: rgba(127, 127, 127, 0.38);
    transition: background 0.2s;
}
.chihiro-bot-switch > div > div {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    margin: 0 !important;
    border: 0 !important;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
    transition: transform 0.2s;
}
.chihiro-bot-switch input:checked ~ div {
    background: var(--color-main);
}
.chihiro-bot-switch input:checked ~ div > div {
    transform: translateX(18px);
}
.chihiro-bot-tabs {
    display: flex;
    padding: 3px;
    background: rgba(127, 127, 127, 0.14);
    border-radius: 10px;
}
.chihiro-bot-tabs button {
    appearance: none;
    min-width: 52px;
    height: 28px;
    margin: 0;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--color-font-2);
    font-size: 13px;
    cursor: pointer;
}
.chihiro-bot-tabs button.is-on {
    background: var(--color-card-1);
    color: var(--color-font);
    font-weight: 600;
}
.chihiro-bot-tabs.disabled,
.chihiro-bot-select:has(select:disabled) {
    opacity: 0.45;
    pointer-events: none;
}
.chihiro-bot-select {
    position: relative;
    height: 32px;
    min-width: 132px;
    max-width: 176px;
    flex: 0 0 auto;
}
.chihiro-bot-select::after {
    content: "";
    position: absolute;
    pointer-events: none;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 5px solid var(--color-font-2);
}
.chihiro-bot-select select {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    width: 100%;
    height: 100%;
    background: rgba(var(--color-bg-rgb), 0.72) !important;
    color: var(--color-font);
    border: 1px solid rgba(127, 127, 127, 0.35) !important;
    padding: 0 28px 0 14px;
    border-radius: 999px !important;
    font-size: 0.78rem;
    line-height: 30px;
    outline: none;
}
.chihiro-bot-setup {
    appearance: none;
    height: 32px;
    min-width: 132px;
    max-width: 176px;
    margin: 0;
    padding: 0 14px;
    border: 1px solid rgba(127, 127, 127, 0.35);
    border-radius: 999px;
    background: rgba(var(--color-bg-rgb), 0.72);
    color: rgb(var(--v-theme-primary));
    font-size: 0.78rem;
    line-height: 30px;
    cursor: pointer;
}
.msg-menu-body .chihiro-ai-symbol {
    display: grid;
    place-items: center;
    font-size: 14px;
    line-height: 1;
}
.user-skin.chat-pan > div.info > .chihiro-head-actions .chihiro-feature-btn,
.user-skin.chat-pan > div.info > .chihiro-head-actions .chihiro-history-btn,
.user-skin.chat-pan > div.info > .chihiro-head-actions .more {
    background: transparent !important;
    border-radius: 50%;
    cursor: pointer;
    height: 32px !important;
    width: 32px !important;
    margin: 0 !important;
    display: grid;
    place-items: center;
    transition: background 0.15s ease, color 0.15s ease;
}
.user-skin.chat-pan > div.info > .chihiro-head-actions .chihiro-feature-btn svg,
.user-skin.chat-pan > div.info > .chihiro-head-actions .chihiro-history-btn svg,
.user-skin.chat-pan > div.info > .chihiro-head-actions .more svg {
    color: var(--color-font-1) !important;
    height: 16px !important;
    width: 16px !important;
    margin: 0 !important;
    pointer-events: none;
}
.user-skin.chat-pan > div.info > .chihiro-head-actions .chihiro-feature-btn .chihiro-ai-symbol {
    display: grid;
    place-items: center;
    color: var(--color-font-1);
    font-size: 22px;
    line-height: 1;
    pointer-events: none;
    user-select: none;
}
.user-skin.chat-pan > div.info > .chihiro-head-actions .chihiro-feature-btn.on .chihiro-ai-symbol {
    color: rgb(var(--v-theme-primary));
}
.user-skin.chat-pan > div.info > .chihiro-head-actions .chihiro-feature-btn:hover,
.user-skin.chat-pan > div.info > .chihiro-head-actions .chihiro-history-btn:hover,
.user-skin.chat-pan > div.info > .chihiro-head-actions .chihiro-history-btn.active,
.user-skin.chat-pan > div.info > .chihiro-head-actions .more:hover {
    background: rgba(127, 127, 127, 0.18) !important;
}
.chihiro-history-mask {
    position: absolute;
    inset: 0;
    z-index: 25 !important;
    background: rgba(0, 0, 0, 0.45);
    pointer-events: all;
    display: grid;
    place-items: center;
    padding: 28px 24px;
    box-sizing: border-box;
}
.chihiro-history-win {
    display: flex;
    flex-direction: column;
    width: min(780px, 100%);
    height: min(680px, 100%);
    min-height: 0;
    padding: 0 20px 0;
    background: var(--color-card);
    border: 1px solid var(--color-card-2);
    border-radius: 14px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    pointer-events: all;
}
.chihiro-history-head {
    display: grid;
    grid-template-columns: 36px 1fr 36px;
    align-items: center;
    padding: 12px 4px 12px;
    margin: 0 -8px 10px;
    color: var(--color-font);
    border-bottom: 1px solid var(--color-card-2);
}
.chihiro-history-title {
    grid-column: 2;
    text-align: center;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.02em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.chihiro-history-close {
    grid-column: 3;
    justify-self: end;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 6px;
    cursor: pointer;
    color: var(--color-font-1);
}
.chihiro-history-close:hover {
    background: var(--color-card-2);
}
.chihiro-history-close svg {
    width: 14px !important;
    height: 14px !important;
    margin: 0 !important;
}
.chihiro-history-search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 12px;
    border: 1px solid var(--color-main);
    border-radius: 8px;
    background: var(--color-card-1);
}
.chihiro-history-search svg {
    width: 14px !important;
    height: 14px !important;
    margin: 0 !important;
    color: var(--color-font-2) !important;
    flex: 0 0 auto;
}
.chihiro-history-search input {
    flex: 1;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--color-font);
    font-size: 13px;
    height: 100%;
}
.chihiro-history-tabs {
    display: flex;
    align-items: center;
    gap: 28px;
    padding: 14px 4px 0;
    border-bottom: 1px solid var(--color-card-2);
}
.chihiro-history-tabs button {
    appearance: none;
    background: none;
    border: 0;
    color: var(--color-font-1);
    font-size: 14px;
    padding: 0 0 10px;
    cursor: pointer;
    position: relative;
}
.chihiro-history-tabs button.active {
    color: var(--color-font);
    font-weight: 600;
}
.chihiro-history-tabs button.active::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: var(--color-main);
    border-radius: 2px;
}
.chihiro-history-list {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    padding: 4px 0 20px;
}
.chihiro-history-date {
    color: var(--color-font-2);
    font-size: 13px;
    padding: 16px 4px 10px;
    border-bottom: 1px solid var(--color-card-2);
    margin-bottom: 2px;
}
.chihiro-history-item {
    display: flex;
    gap: 12px;
    padding: 14px 4px;
    border-bottom: 1px solid var(--color-card-2);
    cursor: pointer;
}
.chihiro-history-item:hover {
    background: var(--color-card-1);
}
.chihiro-history-item img {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    flex: 0 0 auto;
    background: var(--color-card-2);
}
.chihiro-history-text {
    color: var(--color-font);
    font-size: 14px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
    min-width: 0;
}
.chihiro-history-empty {
    color: var(--color-font-2);
    text-align: center;
    padding: 56px 0;
    font-size: 13px;
}

.user-skin.chat-pan > div.info {
    margin: 0 !important;
    width: 100% !important;
    height: 52px !important;
    min-height: 52px;
    padding: 0 16px !important;
    box-sizing: border-box !important;
    border-radius: 0 !important;
    background: var(--color-bg) !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
    border-bottom: 1px solid rgba(127, 127, 127, 0.12);
}
.user-skin.chat-pan .face-pan,
.user-skin.chat-pan .jin-pan {
    background: var(--color-card) !important;
    backdrop-filter: none !important;
}
.user-skin.chat-pan > div.info > img {
    width: 28px !important;
    height: 28px !important;
    border-radius: 50% !important;
    border: 0 !important;
    margin-right: 8px !important;
}
.user-skin.chat-pan > div.info > div.info p {
    font-size: 14px !important;
    font-weight: 600;
}
.user-skin.chat-pan > div.info > div.info span {
    display: none;
}
.user-skin.chat-pan > div.info > svg.back {
    width: 16px !important;
    height: 16px !important;
    padding: 8px !important;
    margin-right: 8px !important;
    border-radius: 50% !important;
    background: transparent !important;
}

.forward-float-enter-active,
.forward-float-leave-active {
    transition: opacity 0.2s ease !important;
}
.forward-float-enter-active > div.card,
.forward-float-leave-active > div.card {
    animation: none !important;
    transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important;
}
.forward-float-enter-from,
.forward-float-leave-to {
    opacity: 0;
}
.forward-float-enter-from > div.card,
.forward-float-leave-to > div.card {
    opacity: 1;
    transform: translate(-50%, -50%) scale(0.96) !important;
}
</style>
