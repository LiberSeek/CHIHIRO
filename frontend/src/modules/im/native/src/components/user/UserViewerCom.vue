<template>
    <Teleport to="#chihiro-im-overlays">
        <Transition name="global-session-search-bar">
            <div v-if="currentImg" v-esc="escClose"
                v-move="moveOptions"
                class="mask-background chihiro-image-viewer"
                @click="closeClick"
                @v-move-left="nextImg"
                @v-move-right="prevImg"
                @mousemove="mouseMoveCheck">
                <!-- 工具扩展设置 -->
                <TransitionGroup class="viewer-bar viewer-tool-config-bar"
                    name="viewer-tool-config" tag="div"
                    :class="{ dragging: dragging }"
                    @click.stop>
                    <!-- 颜色 -->
                    <template v-if="currentTool !== 'hand'">
                        <div v-for="(color, key) in colorMap"
                            :key="key"
                            class="color"
                            :style="{'--color': color}"
                            :class="{'active': currentColor === key}"
                            @click.stop="selectColor(key)" />
                    </template>
                    <!-- 线条粗细 -->
                    <template v-if="currentTool !== 'hand'">
                        <hr>
                        <div v-for="size in lineWidthList"
                            :key="size"
                            class="line-width"
                            :class="{'active': currentLineWidth === size}"
                            @click.stop="selectLineWidth(size)">
                            <div :style="{'--line-width': size + 'px'}" />
                        </div>
                    </template>
                    <!-- 是否填充 -->
                    <template v-if="currentTool === 'rect'">
                        <hr>
                        <font-awesome-icon
                            class="rect-is-fill"
                            :icon="[toolConfig.rect.fill ? 'fas' : 'far', 'square']"
                            @click.stop="toolConfig.rect.fill = !toolConfig.rect.fill" />
                    </template>
                </TransitionGroup>
                <!-- 按钮栏 -->
                <div>
                    <Transition name="viewer-button" mode="out-in">
                        <!-- 普通栏 -->
                        <div v-if="!edit"
                            key="1"
                            class="viewer-bar viewer-button-bar chihiro-viewer-bar force-show"
                            :class="{ dragging: dragging }"
                            @click.stop>
                            <div v-if="sourceMsg" class="chihiro-viewer-sender">
                                <img :src="senderAvatar" alt="">
                                <div class="chihiro-viewer-sender-text">
                                    <span class="chihiro-viewer-sender-name">{{ senderName }}</span>
                                    <span class="chihiro-viewer-sender-time">{{ senderTime }}</span>
                                </div>
                            </div>
                            <div class="chihiro-viewer-actions">
                                <font-awesome-icon :icon="['fas', 'magnifying-glass-minus']"
                                    @click.stop="zoomOut" />
                                <font-awesome-icon :icon="['fas', 'magnifying-glass-plus']"
                                    @click.stop="zoomIn" />
                                <font-awesome-icon :icon="['fas', 'rotate-right']"
                                    @click.stop="rotate(90)" />
                                <hr>
                                <font-awesome-icon :icon="['fas', 'download']"
                                    @click.stop="download" />
                                <font-awesome-icon :icon="['fas', 'share']"
                                    @click.stop="forwardImg" />
                                <div class="chihiro-viewer-more">
                                    <font-awesome-icon :icon="['fas', 'ellipsis']"
                                        @click.stop="toggleViewerMore" />
                                    <div v-if="viewerMoreOpen" class="chihiro-viewer-more-menu" @click.stop>
                                        <button type="button" @click.stop="saveAs">{{ $t('另存为') }}</button>
                                        <button type="button" @click.stop="copyImage">{{ $t('拷贝图像') }}</button>
                                        <button v-if="sourceMsg" type="button" @click.stop="locateInChat">{{ $t('定位对话') }}</button>
                                        <button v-if="sourceMsg" type="button" @click.stop="shareImage">{{ $t('分享图像') }}</button>
                                        <button v-if="isOwnImage" type="button" @click.stop="editAndSend">{{ $t('编辑与发送') }}</button>
                                        <button v-if="isOwnImage" type="button" class="is-danger" @click.stop="deleteImage">{{ $t('删除') }}</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- 编辑栏 -->
                        <div v-else
                            key="2"
                            :class="{dragging: dragging}"
                            class="viewer-bar viewer-button-bar force-show"
                            @click.stop>
                            <font-awesome-icon :icon="['fas', 'hand']"
                                :class="{ active: currentTool === 'hand' }"
                                @click.stop="switchTool('hand')" />
                            <font-awesome-icon :icon="['fas', 'pencil']"
                                :class="{ active: currentTool === 'pen' }"
                                @click.stop="switchTool('pen')" />
                            <font-awesome-icon :icon="['fas', 'object-group']"
                                :class="{ active: currentTool === 'rect' }"
                                @click.stop="switchTool('rect')" />
                            <hr>
                            <font-awesome-icon :icon="['fas', 'share']" style="transform: rotateY(180deg);"
                                @click.stop="rotate(-90)" />
                            <font-awesome-icon :icon="['fas', 'share']"
                                @click.stop="rotate(90)" />
                            <hr>
                            <font-awesome-icon :icon="['fas', 'undo']"
                                @click.stop="editUndo" />
                            <hr>
                            <font-awesome-icon :icon="['fas', 'download']"
                                @click.stop="downloadCanvas" />
                            <font-awesome-icon :icon="['fas', 'clipboard']"
                                @click.stop="editCopy" />
                            <hr>
                            <font-awesome-icon :icon="['fas', 'xmark']"
                                @click.stop="editExit" />
                            <font-awesome-icon v-if="currentImgInfo?.editMode || sendAfterEdit" :icon="['fas', 'check']"
                                @click.stop="editFinish" />
                        </div>
                    </Transition>
                </div>
                <Transition mode="out-in"
                    :name="`viewer-change-img-${changeViewerCssName}`">
                    <div :key="currentImg?.src">
                        <div v-if="loading" class="viewer loading cursor-exit">
                            <font-awesome-icon :icon="['fas', 'spinner']" />
                        </div>
                        <div v-else
                            :class="{
                                'viewer-img': true,
                                'grab': mouseMoveInfo,
                                'zooming': zoomTimeout,
                                'cursor-not-allowed': edit,
                                'cursor-exit': !edit,
                            }"
                            @touchstart="onGlobalTouchStart"
                            @touchmove="onGlobalTouchMove"
                            @touchend="onGlobalTouchEnd">
                            <!-- 水平滚动条 -->
                            <div v-hide="!showScrollbarX" class="scrollbar x"
                                :class="{ 'dragging': scrollBarDrag === 'x' }"
                                @wheel.stop.prevent="onScrollbarWheel('x', $event)"
                                @mousedown="onScrollbarDrag('x', $event)">
                                <div class="scrollbar-thumb" :style="scrollbarThumbXStyle" />
                            </div>
                            <!-- 垂直滚动条 -->
                            <div v-hide="!showScrollbarY" class="scrollbar y"
                                :class="{ 'dragging': scrollBarDrag === 'y' }"
                                @wheel.stop.prevent="onScrollbarWheel('y', $event)"
                                @mousedown.stop.prevent="onScrollbarDrag('y', $event)">
                                <div class="scrollbar-thumb" :style="scrollbarThumbYStyle" />
                            </div>
                            <img v-show="!edit"
                                :key="currentImg?.src"
                                :class="getImgCursorClassByTool()"
                                referrerpolicy="no-referrer"
                                :src="viewerImageSrc"
                                :style="viewerTransformStyle"
                                alt=""
                                @wheel="onWheel"
                                @click.stop.prevent="onClick"
                                @mousedown="onMouseDown"
                                @mousemove="onMouseMove"
                                @mouseup="onMouseUp"
                                @touchstart="onImgTouchStart"
                                @touchmove="onImgTouchMove"
                                @touchend="onImgTouchEnd"
                                @mouseleave="mouseMoveInfo=undefined">
                            <canvas v-show="edit" ref="canvas"
                                :class="getImgCursorClassByTool()"
                                :style="viewerTransformStyle"
                                @wheel="onWheel"
                                @click.stop="onClick"
                                @mousedown.stop.prevent="onMouseDown"
                                @mousemove.stop.prevent="onMouseMove"
                                @mouseup.stop.prevent="onMouseUp"
                                @mouseout.stop="onMouseout"
                                @touchstart="onImgTouchStart"
                                @touchmove="onImgTouchMove"
                                @touchend="onImgTouchEnd"
                                @mouseleave="mouseMoveInfo=undefined;" />
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
import { PopInfo, PopType } from '@renderer/function/base'
import { mousemoveMask } from '@renderer/function/input'
import { Img } from '@renderer/function/model/img'
import { copyToClipboard, getTrueLang, getViewTime } from '@renderer/function/utils/systemUtil'
import {
	downloadFile,
    scrollToMsg,
    vEsc,
    vHide,
    vMove,
    VMoveOptions,
    useKeyboard,
    useViewportUnits
} from '@renderer/function/utils/appUtil'
import { i18n } from '@chihiro/im-native/host'
import {
    computed,
    shallowReactive,
    shallowRef,
    toRaw,
    useTemplateRef,
} from 'vue'
import { backend } from '@renderer/runtime/backend'
import { useUIStore } from '@renderer/state/ui'
import { useChatStore } from '@renderer/state/chat'
import { useAuthStore } from '@renderer/state/auth'
import {
    captureNativeAsyncScope,
    isNativeAsyncScopeCurrent,
    type NativeAsyncScope,
} from '@renderer/function/asyncAccountScope'

const uiStore = useUIStore()
const chatStore = useChatStore()
const authStore = useAuthStore()
let viewerGeneration = 0
function currentConversationId() {
    const show = chatStore.chatInfo.show as typeof chatStore.chatInfo.show & { temp?: string }
    return `${String(show.id ?? '')}:${show.temp ?? ''}`
}

type EditToolType = 'hand' | 'pen' | 'rect'

const colorMap = {
    'red': '#F0534C',
    'yellow': '#FDC700',
    'green': '#04C160',
    'blue': '#0EAFFF',
    'purple': '#6566F4',
    'black': '#000000',
    'white': '#ffffff',
}
const lineWidthList = [3, 5, 10, 15, 20]

type Color = keyof typeof colorMap

const currentImg = shallowRef<Img | undefined>()
const displaySrcOverrides = shallowReactive(new WeakMap<Img, string>())
const modify = shallowReactive({
    rotate: 0,
    scale: 1,
    x: 0,
    y: 0,
})
const { vw, vh } = useViewportUnits()

const canvas = useTemplateRef('canvas')
const prev = computed(() => currentImg.value?.prev)
const next = computed(() => currentImg.value?.next)
const viewerImageSrc = computed(() => getViewerImageSrc(currentImg.value))
const activeToolConfig = computed(() => currentTool.value === 'hand' ? toolConfig.pen : toolConfig[currentTool.value])
const currentColor = computed(() => activeToolConfig.value.color)
const currentLineWidth = computed(() => activeToolConfig.value.width)
const viewerTransformStyle = computed(() => ({
    '--x': modify.x + 'px',
    '--y': modify.y + 'px',
    '--rotate': modify.rotate + 'deg',
    '--scale': modify.scale,
    '--width': currentImgInfo.value?.width + 'px',
    '--height': currentImgInfo.value?.height + 'px',
}))
const loading = shallowRef(true)
const edit = shallowRef(false)
const dragging = shallowRef(false)
const currentImgInfo = shallowRef<{
    width: number,                          // 图片实际宽度
    height: number,                         // 图片实际高度
    dom: HTMLImageElement,                  // 图片原始dom
    editMode: false,                        // 是否为编辑模式
} | {
    width: number,                          // 图片实际宽度
    height: number,                         // 图片实际高度
    dom: HTMLImageElement,                  // 图片原始dom
    editMode: true,                         // 是否为编辑模式
    editPromise: (data: string) => void,    // 编辑完成回调
    scope: NativeAsyncScope,
        } | undefined>(undefined)
const mouseMoveInfo = shallowRef<{
    x: number,
    y: number,
    modifyX: number,
    modifyY: number
} | undefined>(undefined)
const zoomTimeout = shallowRef<ReturnType<typeof setTimeout> | undefined>()
const moveTimeout = shallowRef<ReturnType<typeof setTimeout> | undefined>()
const scrollBarDrag = shallowRef<undefined | 'x' | 'y'>()
const changeViewerCssName = shallowRef('next')

const forceShowButton = shallowRef(false)
const viewerMoreOpen = shallowRef(false)
const sendAfterEdit = shallowRef(false)
const trueLang = getTrueLang()

const sourceMsg = computed(() => {
    const img = currentImg.value
    if (!img) return undefined
    const raw = img._src
    const proxied = img.src
    return chatStore.messageList.find((item: any) =>
        item.message?.some((seg: any) =>
            seg.type === 'image' && (seg.url === raw || seg.url === proxied),
        ),
    )
})
const senderName = computed(() => {
    const sender = sourceMsg.value?.sender
    if (!sender) return ''
    return sender.card || sender.nickname || ''
})
const senderAvatar = computed(() => {
    const id = sourceMsg.value?.sender?.user_id
    if (!id) return ''
    return `https://q1.qlogo.cn/g?b=qq&s=0&nk=${id}`
})
const senderTime = computed(() => {
    const time = sourceMsg.value?.time
    if (!time) return ''
    return Intl.DateTimeFormat(trueLang, {
        hour: 'numeric',
        minute: 'numeric',
    }).format(new Date(getViewTime(time)))
})
const isOwnImage = computed(() => {
    const msg = sourceMsg.value
    if (!msg?.sender) return false
    return Number(msg.sender.user_id) === Number(authStore.loginInfo.uin)
})

function getViewerImageSrc(img = currentImg.value): string {
    if (!img) return ''
    return displaySrcOverrides.get(img) ?? img.src
}

let canCors: boolean = false
setTimeout(()=>{
    canCors = !backend.isWeb()
}, 10)

// 双指缩放相关状态
let touchResizeInfo: {
    initialDistance: number,
    initialScale: number,
    initialX: number,
    initialY: number,
    centerX: number,
    centerY: number
} | undefined

const currentTool = shallowRef<EditToolType>('hand')
const toolConfig = {
    pen: shallowReactive({
        color: 'red',
        width: 5,
    }),
    rect: shallowReactive({
        color: 'red',
        fill: false,
        width: 5,
    }),
}

const $t = i18n.global.t

//#region == 公开函数 ===============================================
/**
 * 打开一张图片预览
 * @param img 图片节点
 */
function open(img: Img) {
    currentImg.value = toRaw(img)
    init()
}

function openBySrc(img: Img, src: string, displaySrc?: string) {
    currentImg.value = toRaw(img)
    const target = currentImg.value.getBySrc(src)
    if (!target) {
        new PopInfo().add(PopType.ERR, $t('定位图片失败'))
        return
    }
    currentImg.value = toRaw(target)
    if (displaySrc) displaySrcOverrides.set(currentImg.value, displaySrc)
    init()
}

/**
 * 编辑一张图片
 * @param dataurl 图片url
 * @returns 编辑完成后的dataurl
 */
async function editMode(
    dataurl: string,
    scope = captureNativeAsyncScope(
        chatStore.chatInfo.show.type,
        currentConversationId(),
    ),
): Promise<string> {
    const generation = ++viewerGeneration
    let r!: (dataurl: string) => void
    const promise = new Promise<string>(resolve => {
        r = resolve
    })
    currentImg.value = new Img(dataurl)

    const img = new Image()
    img.src = dataurl
    setTimeout(()=>{
        if (generation !== viewerGeneration) {
            r(dataurl)
            return
        }
        currentImgInfo.value = {
            width: img.width,
            height: img.height,
            dom: img,
            editMode: true,
            editPromise: r,
            scope,
        }
        mouseMoveInfo.value = undefined
        loading.value = false
        resetModify()
        setTimeout(editImg, 0)
    }, 0)
    return promise
}
//#endregion

/**
 * 重置变形参数
 */
function resetModify() {
    modify.rotate = 0
    autoFit()
}
/**
 * 自动匹配大小
 */
function autoFit() {
    const info = currentImgInfo.value
    if (!info) return
    // 长图
    if (info.height / info.width > 2.5) {
        modify.scale = Math.min(vh.value * 100 / 2, info.width, vw.value * 90) / info.width
        modify.x = 0
        modify.y = info.height * modify.scale / 2 - vh.value * 50
    }
    // 正常图片
    else {
        stdFit()
    }
}
/**
 * 标准化大小
 */
function stdFit() {
    const info = currentImgInfo.value
    if (!info) return
    modify.scale = 1
    modify.x = 0
    modify.y = 0
    let scale: number
    if (modify.rotate % 180 === 0) {
        const scaleX = vw.value * 100 / (info.width * 1.2)
        const scaleY = vh.value * 100 / (info.height * 1.2)
        scale = Math.min(scaleX, scaleY)
    }else {
        const scaleX = vw.value * 100 / (info.height * 1.2)
        const scaleY = vh.value * 100 / (info.width * 1.2)
        scale = Math.min(scaleX, scaleY)
    }
    if (scale < 1)
        modify.scale = scale
}
/**
 * 初始化参数
 */
function init() {
    if (!currentImg.value) return
    const generation = ++viewerGeneration
    const img = new Image()
    const loadFinish = () => {
        if (generation !== viewerGeneration || !currentImg.value) return
        loading.value = false
        currentImgInfo.value = {
            width: img.width,
            height: img.height,
            dom: img,
            editMode: false,
        }

        resetModify()
    }
    if (canCors)
        img.crossOrigin = 'anonymous'

    if(backend.type === 'capacitor' && backend.function && 'plugins' in backend.function && 'CapacitorHttp' in backend.function.plugins) {
        const capacitorHttp = backend.function.plugins.CapacitorHttp
        capacitorHttp.get({
            url: getViewerImageSrc(),
            responseType: 'blob',
        }).then((r: any) => {
            if (generation !== viewerGeneration || !currentImg.value) return
            img.src = 'data:image/png;base64,' + r.data
        }).catch(() => {
            if (generation !== viewerGeneration || !currentImg.value) return
            img.src = getViewerImageSrc()
        })
    } else {
        img.src = getViewerImageSrc()
    }

    img.onload = loadFinish
    loading.value = true
    mouseMoveInfo.value = undefined
    viewerMoreOpen.value = false
    sendAfterEdit.value = false
}
function closeClick() {
    // 太容易误触了,干脆编辑模式禁止通过这样退出吧
    if(edit.value) return
    close()
}
function escClose() {
    if(edit.value) editExit()
    else close()
}
function close() {
    viewerGeneration++
    if (edit.value) editExit()
    else if (currentImgInfo.value?.editMode) {
        currentImgInfo.value.editPromise(currentImg.value?.src ?? '')
    }
    currentImg.value = undefined
    forceShowButton.value = false
    viewerMoreOpen.value = false
    sendAfterEdit.value = false
}
//#region == 顶部按钮 ===============================================
/**
 * 下一张图片
 */
function nextImg() {
    if (!next.value) return
    changeViewerCssName.value = 'next'
    currentImg.value = currentImg.value?.next
    init()
}
/**
 * 上一张图片
 */
function prevImg() {
    if (!prev.value) return
    changeViewerCssName.value = 'prev'
    currentImg.value = currentImg.value?.prev
    init()
}
/**
 * 下载图片
 */
async function download() {
    if (canCors) {
        const data = await getBlob()
        if (!data) {
            new PopInfo().add(PopType.ERR, $t('下载失败'))
            return
        }
        downloadFile(URL.createObjectURL(data), 'img.png', () => undefined, () => undefined)
    }else {
        if (!currentImg.value) return
        downloadFile(getViewerImageSrc(), 'img.png', () => undefined, () => undefined)
    }
}
/**
 * 复制图片
 */
async function copy() {
    const blob = await getBlob()
    await copyBlob(blob)
}
/**
 * 设置旋转角度
 * @param deg 角度
 */
function rotate(deg: number) {
    const oldRotate = modify.rotate
    modify.rotate = oldRotate + deg
    stdFit()
}

function zoomIn() {
    if (loading.value) return
    modify.scale /= 0.9
}

function zoomOut() {
    if (loading.value) return
    modify.scale *= 0.9
}

function toggleViewerMore() {
    viewerMoreOpen.value = !viewerMoreOpen.value
}

function saveAs() {
    viewerMoreOpen.value = false
    download()
}

function copyImage() {
    viewerMoreOpen.value = false
    copy()
}

function locateInChat() {
    const msg = sourceMsg.value
    viewerMoreOpen.value = false
    if (!msg?.message_id) {
        new PopInfo().add(PopType.INFO, $t('无法定位'))
        return
    }
    const id = msg.message_id
    const scope = captureNativeAsyncScope(
        chatStore.chatInfo.show.type,
        currentConversationId(),
    )
    close()
    setTimeout(() => {
        if (!isNativeAsyncScopeCurrent(
            scope,
            chatStore.chatInfo.show.type,
            currentConversationId(),
        )) return
        scrollToMsg('chat-' + id, true)
    }, 50)
}

function shareImage() {
    viewerMoreOpen.value = false
    forwardImg()
}

function editAndSend() {
    viewerMoreOpen.value = false
    sendAfterEdit.value = true
    editImg()
}

function deleteImage() {
    const msg = sourceMsg.value
    viewerMoreOpen.value = false
    if (!msg) return
    window.dispatchEvent(new CustomEvent('chihiro-viewer-delete', {
        detail: {
            message: toRaw(msg),
            scope: captureNativeAsyncScope(
                chatStore.chatInfo.show.type,
                currentConversationId(),
            ),
        },
    }))
    close()
}

function forwardImg() {
    const msg = sourceMsg.value
    if (!msg) {
        new PopInfo().add(PopType.INFO, $t('无法转发'))
        return
    }
    window.dispatchEvent(new CustomEvent('chihiro-viewer-forward', {
        detail: {
            message: toRaw(msg),
            scope: captureNativeAsyncScope(
                chatStore.chatInfo.show.type,
                currentConversationId(),
            ),
        },
    }))
    close()
}

/**
 * 编辑图片
 */
function editImg() {
    if (!currentImgInfo.value) return
    const ctx = canvas.value?.getContext('2d')
    if (!ctx) return

    edit.value = true

    canvas.value!.width = currentImgInfo.value.width
    canvas.value!.height = currentImgInfo.value.height
    ctx.drawImage(currentImgInfo.value?.dom, 0, 0)

    switchTool('pen')
}
//#endregion

//#region == 编辑按钮 ===============================================
let editHistory: ImageData[] = []
/**
 * 颜色选择
 * @param color 颜色
 */
function selectColor(color: Color) {
    if (currentTool.value === 'hand') return
    toolConfig[currentTool.value].color = color
}

/**
 * 选择线条宽度
 * @param width 宽度
 */
function selectLineWidth(width: number) {
    if (currentTool.value === 'hand') return
    toolConfig[currentTool.value].width = width
}
/**
 * 切换编辑工具
 * @param tool
 */
function switchTool(tool: EditToolType) {
    currentTool.value = tool
}
/**
 * 撤销
 */
function editUndo() {
    const ctx = canvas.value?.getContext('2d')
    if (!ctx || editHistory.length === 0) return
    const last = editHistory.pop()
    if (last) ctx.putImageData(last, 0, 0)
}
/**
 * 下载
 */
async function downloadCanvas() {
    const data = await getBlob()
    if (!data) {
        new PopInfo().add(PopType.ERR, $t('下载失败'))
        return
    }
    downloadFile(URL.createObjectURL(data), 'img.png', () => undefined, () => undefined)
}
/**
 * 退出编辑
 */
function editExit() {
    edit.value = false
    currentTool.value = 'hand'
    editHistory = []
    sendAfterEdit.value = false

    // 如果是编辑模式打开的图片，返回结果
    const info = currentImgInfo.value
    if (info?.editMode) {
        const src = currentImg.value?.src ?? ''
        info.editPromise(src)
        close()
    }
}
/**
 * 接受编辑结果
 */
function editFinish() {
    edit.value = false
    currentTool.value = 'hand'
    editHistory = []

    if (sendAfterEdit.value) {
        const dataurl = canvas.value!.toDataURL('image/png')
        sendAfterEdit.value = false
        window.dispatchEvent(new CustomEvent('chihiro-viewer-edit-send', {
            detail: {
                dataurl,
                scope: currentImgInfo.value?.editMode
                    ? currentImgInfo.value.scope
                    : captureNativeAsyncScope(
                        chatStore.chatInfo.show.type,
                        currentConversationId(),
                    ),
            },
        }))
        close()
        return
    }

    // 如果是编辑模式打开的图片，返回结果
    if (currentImgInfo.value?.editMode) {
        const dataurl = canvas.value!.toDataURL('image/png')
        currentImgInfo.value.editPromise(dataurl)
        close()
    }
}
/**
 * 复制编辑结果
 */
async function editCopy() {
    // 复制到剪切板
    const blob = await getBlob()
    await copyBlob(blob)
}
//#endregion

//#region == 滚动相关 ===============================================
// 滚动条显示条件
const showScrollbarX = computed(() => {
    if (!currentImgInfo.value || loading.value) return false
    if (modify.rotate % 180 === 0)
        // 图片宽度缩放后是否超出视口宽度
        return currentImgInfo.value.width * modify.scale > vw.value * 100
    else
        return currentImgInfo.value.height * modify.scale > vw.value * 100
})
const showScrollbarY = computed(() => {
    if (!currentImgInfo.value || loading.value) return false
    if (modify.rotate % 180 === 0)
        // 图片高度缩放后是否超出视口高度
        return currentImgInfo.value.height * modify.scale > vh.value * 100
    else
        // 图片高度缩放后是否超出视口高度
        return currentImgInfo.value.width * modify.scale > vh.value * 100
})
// 滑块位置信息
const scrollbarThumbXStyle = computed(() => {
    if (!currentImgInfo.value || loading.value) return {'--thumb': 0, '--pos': 0}

    if (modify.rotate % 180 === 0) {
        const viewW = vw.value * 100
        const imgW = currentImgInfo.value.width * modify.scale
        const ratio = viewW / imgW
        // 计算滑块位置
        const head = imgW / 2 - modify.x - viewW / 2
        const pos = Math.max(0, Math.min(1 - ratio, head / imgW))
        return {'--thumb': ratio, '--pos': pos}
    }else {
        const viewW = vw.value * 100
        const imgH = currentImgInfo.value.height * modify.scale
        const ratio = viewW / imgH
        // 计算滑块位置
        const head = imgH / 2 - modify.x - viewW / 2
        const pos = Math.max(0, Math.min(1 - ratio, head / imgH))
        return {'--thumb': ratio, '--pos': pos}
    }
})
const scrollbarThumbYStyle = computed(() => {
    if (!currentImgInfo.value || loading.value) return {'--thumb': 0, '--pos': 0}

    if (modify.rotate === 0) {
        const viewH = vh.value * 100
        const imgH = currentImgInfo.value.height * modify.scale
        const ratio = viewH / imgH
        // 计算滑块位置
        const head =  imgH / 2 - modify.y - viewH / 2
        const pos = Math.max(0, Math.min(1 - ratio, head / imgH))
        return {'--thumb': ratio, '--pos': pos}
    }else {
        const viewH = vh.value * 100
        const imgW = currentImgInfo.value.width * modify.scale
        const ratio = viewH / imgW
        // 计算滑块位置
        const head =  imgW / 2 - modify.y - viewH / 2
        const pos = Math.max(0, Math.min(1 - ratio, head / imgW))
        return {'--thumb': ratio, '--pos': pos}
    }

})
/**
 * 滚动条滚动事件
 * @param axis 轴向
 * @param event 事件对象
 */
function onScrollbarWheel(axis: 'x'|'y', event: WheelEvent) {
    if (axis === 'x') {
        // 横向滚动
        modify.x -= event.deltaY * 2
        // 限制范围
        const info = currentImgInfo.value
        if (!info) return
        if (modify.rotate % 180 === 0) {
            const maxOffset = (info.width * modify.scale - vw.value * 100) / 2
            modify.x = Math.max(-maxOffset, Math.min(modify.x, maxOffset))
        }
        else{
            const maxOffset = (info.height * modify.scale - vw.value * 100) / 2
            modify.x = Math.max(-maxOffset, Math.min(modify.x, maxOffset))
        }

    } else {
        // 纵向滚动
        modify.y -= event.deltaY * 2
        const info = currentImgInfo.value
        if (!info) return
        if (modify.rotate % 180 === 0) {
            const maxOffset = (info.height * modify.scale - vh.value * 100) / 2
            modify.y = Math.max(-maxOffset, Math.min(modify.y, maxOffset))
        }else {
            const maxOffset = (info.width * modify.scale - vh.value * 100) / 2
            modify.y = Math.max(-maxOffset, Math.min(modify.y, maxOffset))
        }
    }
}
/**
 * 滚动条拖拽事件
 * @param axis
 * @param event
 */
function onScrollbarDrag(axis: 'x' | 'y', event: MouseEvent) {
    let lastPos: number
    scrollBarDrag.value = axis
    const updatePos = (event: MouseEvent) => {
        if (axis === 'x')
            lastPos = event.clientX
        else
            lastPos = event.clientY
    }
    updatePos(event)
    const getDeltaAndUpdate = (event: MouseEvent) => {
        let delta: number
        if (axis === 'x') {
            delta = event.clientX - lastPos
            lastPos = event.clientX
        }else {
            delta = event.clientY - lastPos
            lastPos = event.clientY
        }
        return delta
    }
    mousemoveMask((event: MouseEvent) => {
        const move = getDeltaAndUpdate(event)
        let imgWidth = 0
        let imgHeight = 0
        if (modify.rotate % 180 === 0) {
            imgWidth = currentImgInfo.value?.width || 0
            imgHeight = currentImgInfo.value?.height || 0
        } else {
            imgWidth = currentImgInfo.value?.height || 0
            imgHeight = currentImgInfo.value?.width || 0
        }
        if (axis === 'x') {
            // 横向滚动
            modify.x -= move * imgWidth * modify.scale / (vw.value * 100)
            // 限制范围
            const info = currentImgInfo.value
            if (!info) return true
            if (modify.rotate % 180 === 0) {
                const maxOffset = (info.width * modify.scale - vw.value * 100) / 2
                modify.x = Math.max(-maxOffset, Math.min(modify.x, maxOffset))
            }
            else{
                const maxOffset = (info.height * modify.scale - vw.value * 100) / 2
                modify.x = Math.max(-maxOffset, Math.min(modify.x, maxOffset))
            }
        } else {
            // 纵向滚动
            modify.y -= move * imgHeight * modify.scale / (vh.value * 100)
            const info = currentImgInfo.value
            if (!info) return true
            if (modify.rotate % 180 === 0) {
                const maxOffset = (info.height * modify.scale - vh.value * 100) / 2
                modify.y = Math.max(-maxOffset, Math.min(modify.y, maxOffset))
            }else {
                const maxOffset = (info.width * modify.scale - vh.value * 100) / 2
                modify.y = Math.max(-maxOffset, Math.min(modify.y, maxOffset))
            }
        }
        return true
    }, _ => scrollBarDrag.value = undefined)
}
//#endregion

//#region == 图片事件监听 ============================================
/**
 * 鼠标滚轮事件
 */
function onWheel(event: WheelEvent) {
    // 触控板方位限制
    if (!event.deltaY) return
    if (Math.abs(event.deltaX / event.deltaY) > 0.5) return

    // 阻断事件传播
    handleEvent(event)

    // 滚动缩放标志
    if (zoomTimeout.value) clearTimeout(zoomTimeout.value)
    zoomTimeout.value = setTimeout(() => {
        zoomTimeout.value = undefined
    }, 100)

    // 缩放逻辑
    const prevScale = modify.scale
    let newScale = prevScale
    if (event.deltaY > 0)
        newScale *= 0.9
    else
        newScale /= 0.9

    // 移动位置变换
    const mouseX = event.clientX - (vw.value * 50 + modify.x)
    const mouseY = event.clientY - (vh.value * 50 + modify.y)
    const movX = mouseX * (1 - newScale / prevScale)
    const movY = mouseY * (1 - newScale / prevScale)
    modify.x += movX
    modify.y += movY
    modify.scale = newScale
}
let mouseDownTime = 0
function onMouseDown(event: MouseEvent) {
    handleEvent(event)
    mouseDownTime = Date.now()
    dragging.value = true

    switch (currentTool.value) {
        case 'hand':
            handMouseDown(event.clientX, event.clientY)
            break
        case 'pen':
            penMouseDown(event.clientX, event.clientY)
            break
        case 'rect':
            rectMouseDown(event.clientX, event.clientY)
            break
    }
}
function onMouseMove(event: MouseEvent) {
    handleEvent(event)
    mouseMoveCheck()

    switch (currentTool.value) {
        case 'hand':
            handMouseMove(event.clientX, event.clientY)
            break
        case 'pen':
            penMouseMove(event.clientX, event.clientY)
            break
        case 'rect':
            rectMouseMove(event.clientX, event.clientY)
            break
    }

}
function onMouseUp(event: MouseEvent) {
    handleEvent(event)
    dragging.value = false

    switch (currentTool.value) {
        case 'hand':
            handMouseUp(event.clientX, event.clientY)
            break
        case 'pen':
            penMouseUp(event.clientX, event.clientY)
            break
        case 'rect':
            rectMouseUp(event.clientX, event.clientY)
            break
    }
}
function onClick(event: Event) {
    handleEvent(event)
    if (Date.now() -  mouseDownTime > 200) return

    forceShowButton.value = !forceShowButton.value
}
function onMouseout(event: MouseEvent) {
    onMouseUp(event)
}

let onImgTouchFlag = false
function onImgTouchStart(event: TouchEvent) {
    if (event.touches.length !== 1) return
    dragging.value = true

    mouseDownTime = Date.now()

    handleEvent(event)
    onImgTouchFlag = true
    const touch = event.touches[0]
    switch (currentTool.value) {
        case 'hand':
            handMouseDown(touch.clientX, touch.clientY)
            break
        case 'pen':
            penMouseDown(touch.clientX, touch.clientY)
            break
        case 'rect':
            rectMouseDown(touch.clientX, touch.clientY)
            break
    }
}
function onImgTouchMove(event: TouchEvent) {
    if (event.touches.length !== 1) return
    handleEvent(event)
    const touch = event.touches[0]
    switch (currentTool.value) {
        case 'hand':
            handMouseMove(touch.clientX, touch.clientY)
            break
        case 'pen':
            penMouseMove(touch.clientX, touch.clientY)
            break
        case 'rect':
            rectMouseMove(touch.clientX, touch.clientY)
            break
    }
}
function onImgTouchEnd(event: TouchEvent) {
    if (!onImgTouchFlag) return
    handleEvent(event)
    onImgTouchFlag = false
    dragging.value = false

    // 点击判定
    onClick(event)

    // 结束单指操作
    switch (currentTool.value) {
        case 'hand':
            handMouseUp(0, 0)
            break
        case 'pen':
            penMouseUp(0, 0)
            break
        case 'rect':
            rectMouseUp(0, 0)
            break
    }
}

let onGlobalTouch = false
function onGlobalTouchStart(event: TouchEvent) {
    if (event.touches.length !== 2) return
    handleEvent(event)
    onGlobalTouch = true
    touchResizeStart(event.touches[0], event.touches[1])
}
function onGlobalTouchMove(event: TouchEvent) {
    if (event.touches.length !== 2) return
    handleEvent(event)
    touchResizeKeep(event.touches[0], event.touches[1])
}
function onGlobalTouchEnd(event: TouchEvent) {
    if (!onGlobalTouch) return
    handleEvent(event)
    onGlobalTouch = false
    touchResizeInfo = undefined
}

function handMouseDown(x: number, y: number) {
    mouseMoveInfo.value = { x, y, modifyX: modify.x, modifyY: modify.y }
}
function handMouseMove(x: number, y: number) {
    if (!mouseMoveInfo.value) return

    const dx = x - mouseMoveInfo.value.x
    const dy = y - mouseMoveInfo.value.y
    modify.x = mouseMoveInfo.value.modifyX + dx
    modify.y = mouseMoveInfo.value.modifyY + dy
}
function handMouseUp(_x: number, _y: number) {
    if (!mouseMoveInfo.value) return
    mouseMoveInfo.value = undefined
}

let penLastPoint: {x: number, y: number} | undefined

function penMouseDown(x: number, y: number) {
    const ctx = canvas.value?.getContext('2d')
    if (!ctx) return

    saveEditHistory()
    const point = getPos(x, y)

    // 结尾有圆，开头再补一个圆，好看
    ctx.fillStyle = currentColor.value
    ctx.strokeStyle = currentColor.value
    ctx.lineWidth = currentLineWidth.value
    ctx.beginPath()
    ctx.arc(point.x, point.y, currentLineWidth.value / 2, 0, Math.PI * 2)
    ctx.fill()
    penLastPoint = point
}
function penMouseMove(x: number, y: number) {
    if (!penLastPoint) return
    const ctx = canvas.value?.getContext('2d')
    if (!ctx) return
    const point = getPos(x, y)
    ctx.beginPath()
    ctx.moveTo(penLastPoint.x, penLastPoint.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    // 末端整个圆，防止连接处出现裂缝
    ctx.beginPath()
    ctx.arc(point.x, point.y, currentLineWidth.value / 2, 0, Math.PI * 2)
    ctx.fill()
    penLastPoint = point
}
function penMouseUp(x: number, y: number) {
    if (!penLastPoint) return
    const ctx = canvas.value?.getContext('2d')
    if (!ctx) return
    const point = getPos(x, y)
    ctx.beginPath()
    ctx.moveTo(penLastPoint.x, penLastPoint.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    // 末端整个圆，防止连接处出现裂缝
    ctx.beginPath()
    ctx.arc(point.x, point.y, currentLineWidth.value / 2, 0, Math.PI * 2)
    ctx.fill()
    penLastPoint = undefined
}

let rectStartPoint: {x: number, y: number} | undefined
function rectMouseDown(x: number, y: number) {
    const ctx = canvas.value?.getContext('2d')
    if (!ctx) return
    saveEditHistory()
    ctx.lineWidth = currentLineWidth.value
    ctx.fillStyle = currentColor.value
    ctx.strokeStyle = currentColor.value
    const point = getPos(x, y)
    rectStartPoint = point
}
function rectMouseMove(x: number, y: number) {
    if (!rectStartPoint) return
    const ctx = canvas.value?.getContext('2d')
    if (!ctx) return
    const point = getPos(x, y)
    const lastImg = editHistory.at(-1)
    if (!lastImg) return
    ctx.putImageData(lastImg, 0, 0)
    ctx.beginPath()
    ctx.rect(rectStartPoint.x, rectStartPoint.y, point.x - rectStartPoint.x, point.y - rectStartPoint.y)
    ctx.stroke()
}
function rectMouseUp(x: number, y: number) {
    if (!rectStartPoint) return
    const ctx = canvas.value?.getContext('2d')
    if (!ctx) return
    const lastImg = editHistory.at(-1)
    if (!lastImg) return
    ctx.putImageData(lastImg, 0, 0)
    const point = getPos(x, y)
    ctx.beginPath()
    ctx.rect(rectStartPoint.x, rectStartPoint.y, point.x - rectStartPoint.x, point.y - rectStartPoint.y)
    if (toolConfig.rect.fill)
        ctx.fill()
    else
        ctx.stroke()
    rectStartPoint = undefined
}
function touchResizeStart(point1: Touch, point2: Touch) {
    // 计算两指间的初始距离
    const distance = getTouchDistance(point1, point2)
    // 计算两指中心点
    const centerX = (point1.clientX + point2.clientX) / 2
    const centerY = (point1.clientY + point2.clientY) / 2

    touchResizeInfo = {
        initialDistance: distance,
        initialScale: modify.scale,
        initialX: modify.x,
        initialY: modify.y,
        centerX,
        centerY
    }
}
function touchResizeKeep(point1: Touch, point2: Touch) {
    if (!touchResizeInfo) return

    // 计算当前两指间距离
    const currentDistance = getTouchDistance(point1, point2)
    // 计算缩放比例
    const scaleChange = currentDistance / touchResizeInfo.initialDistance
    let newScale = touchResizeInfo.initialScale * scaleChange

    // 限制缩放范围（0.1倍到10倍）
    newScale = Math.max(0.1, Math.min(newScale, 10))

    // 计算当前两指中心点
    const centerX = (point1.clientX + point2.clientX) / 2
    const centerY = (point1.clientY + point2.clientY) / 2

    // 计算中心点相对于图片中心的偏移
    const viewCenterX = vw.value * 50
    const viewCenterY = vh.value * 50

    // 计算缩放中心相对于视口中心的偏移
    const scaleOffsetX = centerX - viewCenterX
    const scaleOffsetY = centerY - viewCenterY

    // 根据缩放比例调整位置，确保缩放中心保持不变
    const scaleRatio = newScale / touchResizeInfo.initialScale
    const newX = touchResizeInfo.initialX - scaleOffsetX * (scaleRatio - 1)
    const newY = touchResizeInfo.initialY - scaleOffsetY * (scaleRatio - 1)

    // 应用缩放和位移
    modify.scale = newScale
    modify.x = newX
    modify.y = newY
}
/**
 * 计算两个触摸点之间的距离
 */
function getTouchDistance(point1: Touch, point2: Touch): number {
    const dx = point1.clientX - point2.clientX
    const dy = point1.clientY - point2.clientY
    return Math.sqrt(dx * dx + dy * dy)
}
//#endregion

//#region == 滑动监听 ===============================================
const moveOptions: VMoveOptions<HTMLDivElement> = {
    leftLimit: {
        value: 999,
        type: 'px'
    },
    rightLimit: {
        value: 999,
        type: 'px'
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

//#region == 按键监听 ===============================================
useKeyboard('ArrowLeft', 'a', ()=>{
    if (!currentImg.value) return
    if (!prev.value) return
    prevImg()
    return true
})
useKeyboard('ArrowRight', 'd', ()=>{
    if (!currentImg.value) return
    if (!next.value) return
    nextImg()
    return true
})
useKeyboard('ArrowUp', 'w', ()=>{
    if (!currentImg.value) return
    if (loading.value) return
    modify.scale /= 0.9
    return true
})
useKeyboard('ArrowDown', 's', ()=>{
    if (!currentImg.value) return
    if (loading.value) return
    modify.scale *= 0.9
    return true
})
useKeyboard('q', ()=>{
    if (!currentImg.value) return
    if (loading.value) return
    rotate(-90)
    return true
})
useKeyboard('e', ()=>{
    if (!currentImg.value) return
    if (loading.value) return
    rotate(90)
    return true
})
useKeyboard('r', ()=>{
    if (!currentImg.value) return
    if (loading.value) return
    resetModify()
    return true
})
useKeyboard('1', ()=>{
    if (!currentImg.value) return
    if (!edit.value) return
    switchTool('hand')
    return true
})
useKeyboard('2', ()=>{
    if (!currentImg.value) return
    if (!edit.value) return
    switchTool('pen')
    return true
})
useKeyboard('3', ()=>{
    if (!currentImg.value) return
    if (!edit.value) return
    switchTool('rect')
    return true
})
useKeyboard('ctrl+z', ()=>{
    if (!currentImg.value) return
    if (!edit.value) return
    editUndo()
    return true
})
useKeyboard('ctrl+c', ()=>{
    if (!currentImg.value) return
    if (edit.value) editCopy()
    else copy()
    return true
})
useKeyboard('ctrl+s', ()=>{
    if (!currentImg.value) return
    if (edit.value) downloadCanvas()
    else download()
    return true
})
//#endregion

function handleEvent(event: Event) {
    event.stopPropagation()
    event.preventDefault()
}

function getImgCursorClassByTool(): string {
    if (mouseMoveInfo.value) return 'cursor-grabbing'
    switch (currentTool.value) {
        case 'hand': return 'cursor-grab'
        case 'pen': return 'cursor-pen'
        case 'rect': return 'cursor-crosshair'
        default: return ''
    }
}

/**
 * 将dataUrl复制到剪贴板
 * @param dataUrl
 */
async function copyBlob(blob?: Blob) {
    if (!blob) {
        new PopInfo().add(PopType.ERR, $t('复制失败'))
        return
    }
    await copyToClipboard([
        new window.ClipboardItem({ 'image/png': blob })
    ])
    new PopInfo().add(PopType.INFO, $t('复制成功'))
}

async function getBlob(): Promise<Blob|undefined> {
    return new Promise((resolve) => {
        let tmpUrl
        if (edit.value)
            tmpUrl = canvas.value!.toDataURL('image/png')
        else
            tmpUrl = getViewerImageSrc()
        const tmpImg = new Image()
        const newCanvas = document.createElement('canvas')
        const newCtx = newCanvas.getContext('2d')
        if (!newCtx) return resolve(undefined)

        if (modify.rotate % 180 === 0) {
            newCanvas.width = currentImgInfo.value!.width
            newCanvas.height = currentImgInfo.value!.height
        } else {
            newCanvas.width = currentImgInfo.value!.height
            newCanvas.height = currentImgInfo.value!.width
        }

        if (canCors)
            tmpImg.crossOrigin = 'anonymous'
        if (!tmpUrl) return resolve(undefined)
        tmpImg.src = tmpUrl
        tmpImg.onerror = () => resolve(undefined)
        tmpImg.onload = () => {
            newCtx.translate(newCanvas.width / 2, newCanvas.height / 2)
            newCtx.rotate(modify.rotate * Math.PI / 180)
            newCtx.drawImage(tmpImg, -tmpImg.width / 2, -tmpImg.height / 2)

            newCanvas.toBlob((blob) => {
                if (!blob) return resolve(undefined)
                resolve(blob)
            })
        }
    })
}

/**
 * 将屏幕坐标转化为图片上的坐标
 * @param x
 * @param y
 */
function getPos(x: number, y: number): {x: number, y: number} {
    if (!currentImgInfo.value) return { x: 0, y: 0 }
    const viewW = vw.value * 100
    const viewH = vh.value * 100
    const imgW = currentImgInfo.value!.width
    const imgH = currentImgInfo.value!.height
    let imgHWithScaleRotate: number
    let imgWWithScaleRotate: number
    if (modify.rotate % 180 === 0) {
        imgWWithScaleRotate = imgW * modify.scale
        imgHWithScaleRotate = imgH * modify.scale
    } else {
        imgWWithScaleRotate = imgH * modify.scale
        imgHWithScaleRotate = imgW * modify.scale
    }
    const currentWinCenterX = imgWWithScaleRotate / 2 - modify.x
    const currentWinCenterY = imgHWithScaleRotate / 2 - modify.y
    const currentMousePosX = currentWinCenterX - viewW / 2 + x
    const currentMousePosY = currentWinCenterY - viewH / 2 + y
    const posWithRotateX = currentMousePosX / modify.scale
    const posWithRotateY = currentMousePosY / modify.scale
    switch (modify.rotate % 360) {
        case 0:
            return { x: posWithRotateX, y: posWithRotateY }
        case -270:
        case 90:
            return { x: posWithRotateY, y: imgH-posWithRotateX }
        case -180:
        case 180:
            return { x: imgW-posWithRotateX, y: imgH-posWithRotateY }
        case -90:
        case 270:
            return { x: imgW-posWithRotateY, y: posWithRotateX }
        default:
            throw new Error('Invalid rotation angle')
    }
}

/**
 * 保存编辑历史
 */
function saveEditHistory() {
    const ctx = canvas.value?.getContext('2d')
    if (!ctx) return
    let data: ImageData | undefined
    try {
        data = ctx.getImageData(0, 0, canvas.value!.width, canvas.value!.height)
    }catch {/**/}
    if (!data) return
    editHistory.push(data)
    if (editHistory.length > 20) editHistory.shift() // 限制历史长度
}

function mouseMoveCheck() {
    clearTimeout(moveTimeout.value)
    moveTimeout.value = setTimeout(() => {
        moveTimeout.value = undefined
    }, 100)
}

defineExpose({
    open,
    openBySrc,
    edit: editMode,
})
</script>


<style>
/* chihiro-moved-from-user-css */
.mask-background.chihiro-image-viewer {
    /* The teleport host has no layout size; anchor the viewer to the viewport. */
    position: fixed;
    inset: 0;
    --safe-area-bottom: 0px;
}
.viewer-bar {
    width: 100% !important;
    max-width: none;
    margin: 0 !important;
    left: 0;
    right: 0;
}
.viewer-bar::before,
.viewer-bar::after {
    content: none;
    display: none;
}
.viewer-tool-config-bar {
    bottom: calc(56px + var(--safe-area-bottom, 0px)) !important;
    height: 40px;
    padding: 0 20px;
    justify-content: flex-end;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-sizing: border-box;
}
.viewer-tool-config-bar > div.color {
    width: 18px;
    height: 18px;
    margin: 0 8px;
    border: 2px solid rgba(255, 255, 255, 0.75);
    border-radius: 50%;
}
.viewer-tool-config-bar > div.color:hover,
.viewer-tool-config-bar > div.line-width:hover {
    transform: none;
}
.viewer-tool-config-bar > div.line-width,
.viewer-tool-config-bar > svg.rect-is-fill {
    width: 18px;
    height: 18px;
    padding: 4px;
    margin: 0 6px;
    background-color: transparent;
    border-radius: 6px;
}
.viewer-tool-config-bar > svg.rect-is-fill {
    color: rgba(255, 255, 255, 0.85);
}
.viewer-tool-config-bar > div.active {
    border-radius: 50%;
    outline: 2px solid #fff;
    outline-offset: 1px;
}
.viewer-tool-config-bar > hr {
    height: 14px;
    margin: 0 10px;
    border: 0;
    border-left: 1px solid rgba(255, 255, 255, 0.18);
}
.viewer-button-bar {
    bottom: 0 !important;
    height: 56px;
    /* Keep sender details clear of the shell's 56px account rail. */
    padding: 0 24px 0 72px;
    padding-bottom: var(--safe-area-bottom, 0px);
    opacity: 1;
    justify-content: space-between;
    gap: 8px;
    background: transparent !important;
    border: 0;
    border-radius: 0;
    align-items: center;
    box-sizing: border-box;
}
.viewer-button-bar.force-show,
.viewer-button-bar:hover {
    opacity: 1;
}
.viewer-button-bar > svg,
.chihiro-viewer-actions > svg,
.chihiro-viewer-more > svg {
    width: 16px !important;
    height: 16px !important;
    margin: 0 2px !important;
    padding: 10px !important;
    background: transparent !important;
    color: #fff !important;
    border-radius: 8px !important;
    box-sizing: content-box;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55));
}
.viewer-button-bar > svg:hover,
.chihiro-viewer-actions > svg:hover,
.chihiro-viewer-more > svg:hover {
    background: rgba(255, 255, 255, 0.12) !important;
    color: #fff !important;
}
.viewer-button-bar > svg.active {
    background: rgba(255, 255, 255, 0.16) !important;
    color: #fff !important;
    border-radius: 8px !important;
}
.viewer-button-bar > hr,
.chihiro-viewer-actions > hr {
    height: 16px !important;
    width: 0 !important;
    margin: 0 8px !important;
    border: 0 !important;
    border-left: 1px solid rgba(255, 255, 255, 0.35) !important;
    opacity: 1;
    flex-shrink: 0;
}
.chihiro-viewer-bar {
    pointer-events: none;
}
.chihiro-viewer-sender,
.chihiro-viewer-actions,
.chihiro-viewer-more {
    pointer-events: auto;
}
.chihiro-viewer-sender {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 10px;
    min-width: 0;
    max-width: 46%;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
}
.chihiro-viewer-sender img {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.12);
}
.chihiro-viewer-sender-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
}
.chihiro-viewer-sender-name {
    font-size: 13px;
    font-weight: 650;
    line-height: 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.chihiro-viewer-sender-time {
    font-size: 11px;
    line-height: 14px;
    opacity: 0.78;
    margin-top: 2px;
}
.chihiro-viewer-actions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    margin-left: auto;
}
.chihiro-viewer-more {
    position: relative;
    display: flex;
    align-items: center;
    margin-right: 4px;
}
.chihiro-viewer-more-menu {
    position: absolute;
    right: 0;
    bottom: calc(100% + 8px);
    min-width: 160px;
    padding: 6px;
    background: var(--color-card);
    border: 1px solid rgba(127, 127, 127, 0.16);
    border-radius: 10px;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
    z-index: 40;
}
.chihiro-viewer-more-menu button {
    appearance: none;
    display: block;
    width: 100%;
    margin: 0;
    padding: 8px 12px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--color-font);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
}
.chihiro-viewer-more-menu button:hover {
    background: var(--color-card-2);
}
.chihiro-viewer-more-menu button.is-danger {
    color: #ff453a;
}
.chihiro-viewer-more-menu button.is-danger:hover {
    background: rgba(255, 69, 58, 0.12);
}

@media (max-width: 700px) {
    .viewer-bar,
    .viewer-button-bar,
    .viewer-tool-config-bar {
        width: 100% !important;
        max-width: none !important;
        flex-direction: row !important;
        flex-wrap: nowrap;
        top: auto !important;
        left: 0 !important;
        right: 0 !important;
        margin: 0 !important;
    }
    .viewer-button-bar {
        bottom: 0 !important;
        height: 56px !important;
        padding: 0 24px 0 72px !important;
        justify-content: space-between !important;
    }
    .viewer-button-bar > svg {
        margin: 0 2px !important;
    }
    .viewer-button-bar > hr,
    .chihiro-viewer-actions > hr {
        width: 0 !important;
        height: 16px !important;
        transform: none !important;
        margin: 0 8px !important;
    }
    .viewer-tool-config-bar {
        bottom: calc(56px + var(--safe-area-bottom, 0px)) !important;
        justify-content: flex-end;
        background: transparent !important;
    }
}

@media (max-width: 560px) {
    .viewer-button-bar {
        padding: 0 16px 0 66px !important;
    }
    .chihiro-viewer-actions > svg,
    .chihiro-viewer-more > svg {
        padding: 6px !important;
        margin: 0 !important;
    }
    .chihiro-viewer-sender {
        gap: 8px;
    }
    .chihiro-viewer-sender img {
        width: 28px;
        height: 28px;
    }
}
</style>
