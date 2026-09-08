/** Client types shown in the add-account dropdown. QQ is live; others are placeholders. */

export const CLIENTS = [
  {
    id: 'qq',
    name: 'QQ',
    badge: 'QQ',
    enabled: true,
    login: 'qr',
    hint: '将后台拉起 NTQQ，并在工作台内扫码'
  },
  { id: 'telegram', name: 'Telegram', badge: 'TG', enabled: false, login: 'token' },
  { id: 'lark', name: '飞书', badge: '飞', enabled: false, login: 'oauth' },
  { id: 'dingtalk', name: '钉钉', badge: '钉', enabled: false, login: 'oauth' },
  { id: 'wecom', name: '企业微信', badge: '微', enabled: false, login: 'oauth' },
  { id: 'official-account', name: '微信公众号', badge: '公', enabled: false, login: 'token' },
  { id: 'discord', name: 'Discord', badge: 'DC', enabled: false, login: 'token' },
  { id: 'slack', name: 'Slack', badge: 'SL', enabled: false, login: 'token' },
  { id: 'line', name: 'LINE', badge: 'LN', enabled: false, login: 'token' },
  { id: 'kook', name: 'KOOK', badge: 'KK', enabled: false, login: 'token' }
]

export function getClient(id) {
  return CLIENTS.find((c) => c.id === id) || null
}
