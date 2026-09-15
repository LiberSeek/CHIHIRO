export function sumRecentContactUnread(rows) {
  if (!Array.isArray(rows)) return 0
  const seen = new Map()
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const peer = String(row.peerUin ?? row.peer_uin ?? row.user_id ?? row.group_id ?? '')
    if (!peer || peer === '0') continue
    const n = Math.max(0, Math.floor(Number(row.unread) || 0))
    if (n <= 0) continue
    seen.set(peer, Math.max(seen.get(peer) || 0, n))
  }
  let total = 0
  for (const n of seen.values()) total += n
  return total
}

function recentContactRows(body) {
  if (Array.isArray(body)) return body
  if (!body || typeof body !== 'object') return []
  if (Array.isArray(body.data)) return body.data
  if (Array.isArray(body.data?.list)) return body.data.list
  if (Array.isArray(body.list)) return body.list
  return []
}

export async function fetchRecentContactUnread({
  httpHost = '127.0.0.1',
  httpPort,
  httpToken,
  count = 200,
  timeout = 4000,
} = {}) {
  if (!httpPort) throw new Error('missing_http_port')
  const headers = { 'Content-Type': 'application/json' }
  if (httpToken) headers.Authorization = `Bearer ${httpToken}`
  const res = await fetch(`http://${httpHost}:${httpPort}/get_recent_contact`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ count }),
    signal: AbortSignal.timeout(timeout),
  })
  const json = await res.json().catch(() => ({}))
  const ret = json?.retcode
  if (!res.ok || json?.status === 'failed' || (ret != null && Number(ret) !== 0)) {
    throw new Error(json?.message || json?.wording || json?.error || 'get_recent_contact_failed')
  }
  return sumRecentContactUnread(recentContactRows(json))
}
