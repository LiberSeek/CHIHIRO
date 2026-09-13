import { setCustomComponents } from "markstream-vue";
import "markstream-vue/index.css";
import HtmlGenUiNode from "@/modules/agent/native/source/components/chat/message_list_comps/HtmlGenUiNode.vue";
import RefNode from "@/modules/agent/native/source/components/chat/message_list_comps/RefNode.vue";
import ThreadNode from "@/modules/agent/native/source/components/chat/message_list_comps/ThreadNode.vue";
import ThemeAwareMarkdownCodeBlock from "@/modules/agent/native/source/components/shared/ThemeAwareMarkdownCodeBlock.vue";

export const CHAT_MARKDOWN_CUSTOM_TAGS: string[] = ["ref", "html-genui"];

export function registerChatMarkdownComponents() {
  setCustomComponents("chat-message", {
    ref: RefNode,
    thread: ThreadNode,
    "html-genui": HtmlGenUiNode,
    code_block: ThemeAwareMarkdownCodeBlock,
  });
}
