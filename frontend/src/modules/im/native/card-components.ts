import type { Component } from 'vue'
import AutoReply from './src/components/user/jsonComp/AutoReply.vue'
import Contact from './src/components/user/jsonComp/Contact.lua.vue'
import Feed from './src/components/user/jsonComp/Feed.lua.vue'
import Forum from './src/components/user/jsonComp/Forum.vue'
import Mannounce from './src/components/user/jsonComp/Mannounce.vue'
import Map from './src/components/user/jsonComp/Map.vue'
import MiniappLua from './src/components/user/jsonComp/Miniapp.lua.vue'
import Miniapp from './src/components/user/jsonComp/Miniapp.vue'
import Music from './src/components/user/jsonComp/Music.lua.vue'
import Tuwen from './src/components/user/jsonComp/Tuwen.lua.vue'

export const cardComponents: Readonly<Record<string, Component>> = {
  'com.tencent.autoreply': AutoReply,
  'com.tencent.contact.lua': Contact,
  'com.tencent.feed.lua': Feed,
  'com.tencent.forum': Forum,
  'com.tencent.mannounce': Mannounce,
  'com.tencent.map': Map,
  'com.tencent.miniapp.lua': MiniappLua,
  'com.tencent.miniapp_01': Miniapp,
  'com.tencent.music.lua': Music,
  'com.tencent.tuwen.lua': Tuwen,
}
