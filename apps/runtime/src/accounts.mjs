import fs from 'node:fs'
import path from 'node:path'

export function createAccountStore(filePath) {
  function load() {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch {
      return { accounts: [], activeId: null }
    }
  }

  function save(data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  }

  function list() {
    return load()
  }

  function upsert(account, { activate = true } = {}) {
    const data = load()
    const i = data.accounts.findIndex((a) => a.id === account.id)
    const next = {
      ...account,
      updatedAt: new Date().toISOString()
    }
    if (i >= 0) data.accounts[i] = { ...data.accounts[i], ...next }
    else {
      next.createdAt = next.updatedAt
      data.accounts.push(next)
    }
    if (activate) data.activeId = account.id
    save(data)
    return data
  }

  function setActive(id) {
    const data = load()
    if (!data.accounts.some((a) => a.id === id)) {
      throw new Error('account_not_found')
    }
    data.activeId = id
    save(data)
    return data
  }

  function remove(id) {
    const data = load()
    data.accounts = data.accounts.filter((a) => a.id !== id)
    if (data.activeId === id) {
      data.activeId = data.accounts[0]?.id || null
    }
    save(data)
    return data
  }

  return { load, list, upsert, setActive, remove, filePath }
}
