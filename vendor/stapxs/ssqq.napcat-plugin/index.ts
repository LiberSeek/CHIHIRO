import type {
    PluginModule,
    NapCatPluginContext
} from 'napcat-types/napcat-onebot/network/plugin-manger'

export const plugin_init: PluginModule['plugin_init'] = (ctx: NapCatPluginContext) => {
    ctx.router.static('/static', 'webui/dist')

    ctx.router.page({
        path: 'dashboard',
        title: '千寻',
        icon: '📱',
        htmlFile: 'webui/dist/index.html',
        description: '千寻 · Stapxs QQ Lite',
    })
};

export default {
    plugin_init,
}
