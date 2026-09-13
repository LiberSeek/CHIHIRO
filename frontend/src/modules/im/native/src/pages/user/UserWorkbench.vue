<!--
 * Chihiro workbench tab: AstrBot ChatUI sidebar
-->
<template>
    <div class="friend-view">
        <div class="friend-list-container">
            <div class="friend-list">
                <UserListHead v-model="searchInfo" tab="workbench" />
                <div id="chihiro-agent-sidebar-slot" class="chihiro-agent-sidebar-slot" />
            </div>
        </div>
        <div class="friend-list-space agent-chat-host">
            <span class="agent-empty-state">从左侧选择一个 Agent 会话</span>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { ref } from 'vue'
    import UserListHead from '@renderer/components/user/UserListHead.vue'

    defineOptions({ name: 'UserWorkbench' })

    const searchInfo = ref('')
</script>


<style>
/* chihiro-moved-from-user-css */
#base-app #workbenchTab .friend-list > #chihiro-agent-sidebar-slot {
    position: relative;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    padding: 0;
}
#base-app .chihiro-agent-main-slot {
    position: absolute;
    inset: 0;
    left: var(--chihiro-list-width, 320px);
    z-index: 4;
    display: none;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--color-bg);
}
#base-app .chihiro-agent-main-slot.is-visible { display: block; }
#base-app .chihiro-agent-main-slot > .chat-main {
    width: 100%;
    height: 100%;
}
#base-app .friend-list-container,
#base-app .friend-list,
#base-app .friend-list-space,
#base-app .agent-chat-host {
    min-height: 0;
}
#base-app .agent-empty-state {
    margin: auto;
    color: var(--color-font-2);
    font-size: 14px;
}
.chihiro-bot-dock {
    position: relative;
    flex: 0 0 auto;
    align-self: flex-end;
    display: flex;
    align-items: flex-end;
    gap: 6px;
    height: 32px;
}
.chihiro-bot-btn {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--color-font-2);
    display: grid;
    place-items: center;
    cursor: pointer;
    padding: 0;
}
.chihiro-bot-btn.is-on {
    color: var(--color-main);
    background: color-mix(in srgb, var(--color-main) 16%, transparent);
}
.chihiro-bot-think {
    position: absolute;
    right: 42px;
    bottom: 0;
    width: min(280px, 46vw);
    max-height: 160px;
    overflow: auto;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid rgba(127, 127, 127, 0.22);
    background: var(--color-card-1);
    color: var(--color-font);
    font-size: 12px;
    line-height: 1.45;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
    z-index: 5;
}
.chihiro-bot-think .row {
    display: flex;
    gap: 8px;
    margin-top: 8px;
}

#base-app #workbenchTab .friend-view {
    height: 100%;
    display: flex;
    flex-direction: row;
}
#base-app #workbenchTab .friend-list {
    height: 100%;
    display: flex;
    flex-direction: column;
}
#base-app #workbenchTab .friend-list-container {
    height: 100%;
    display: flex;
    flex-direction: row;
}
#base-app #workbenchTab .friend-list-space {
    position: relative;
    display: flex;
    min-width: 0;
    min-height: 0;
    align-items: center;
    justify-content: center;
}
</style>
