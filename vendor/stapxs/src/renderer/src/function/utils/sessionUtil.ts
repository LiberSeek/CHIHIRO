import type { Session } from '../elements/information'

export function getSessionId(item: Session) {
    return Number(item.user_id ?? item.group_id)
}

export function getSessionTime(item: Pick<Session, 'time'>) {
    const time = Number(item.time ?? 0)
    if (!Number.isFinite(time) || time <= 0) return 0
    return time < 1_000_000_000_000 ? time * 1000 : time
}

export function compareSessionsByRecency(a: Session, b: Session) {
    const timeDelta = getSessionTime(b) - getSessionTime(a)
    if (timeDelta !== 0) return timeDelta
    return getSessionId(a) - getSessionId(b)
}

export function shouldApplySessionPreview(
    session: Pick<Session, 'time' | 'raw_msg'>,
    preview: Pick<Session, 'time'>,
) {
    return !session.raw_msg || getSessionTime(preview) >= getSessionTime(session)
}

export function findSessionContact(
    contacts: Session[],
    sessionId: number,
) {
    return contacts.find((item) => {
        return getSessionId(item) === sessionId
    })
}

export function getMissingGroupPreviewSessions(
    contacts: Session[],
    knownSessions: ReadonlyMap<number, Session>,
) {
    return contacts.filter((item) => {
        const sessionId = getSessionId(item)
        return Boolean(item.group_id) &&
            Number.isFinite(sessionId) &&
            sessionId > 0 &&
            !item.time &&
            !item.raw_msg &&
            !knownSessions.has(sessionId)
    })
}

export function resolveIncomingSession(
    contacts: Session[],
    sessionId: number,
    isGroup: boolean,
    senderName?: string,
) {
    const contact = findSessionContact(contacts, sessionId)
    if (contact) return contact

    // 消息事件可能早于好友/群列表返回。先保留会话动态状态，列表加载后再合并真实资料。
    if (isGroup) {
        return {
            group_id: sessionId,
            group_name: String(sessionId),
        } as Session
    }
    return {
        user_id: sessionId,
        nickname: senderName || String(sessionId),
        remark: '',
    } as Session
}

const SESSION_STATE_KEYS = [
    'new_msg',
    'unread',
    'raw_msg',
    'raw_msg_base',
    'time',
    'always_top',
    'message_id',
    'highlight',
    'notice_mode',
] as const

type SessionStateKey = (typeof SESSION_STATE_KEYS)[number]

function copyDefinedSessionState<K extends SessionStateKey>(
    contact: Session,
    currentSession: Session,
    key: K,
) {
    const value = currentSession[key]
    if (value !== undefined) {
        contact[key] = value
    }
}

export function mergeSessionState(
    contact: Session,
    currentSession: Session,
) {
    SESSION_STATE_KEYS.forEach((key) =>
        copyDefinedSessionState(contact, currentSession, key),
    )
    return contact
}

type ContactKind = 'friend' | 'group'

function isContactKind(item: Session, kind: ContactKind) {
    if (kind === 'friend') return Boolean(item.user_id)
    return Boolean(item.group_id) && !item.user_id
}

function replaceStaticContactData(
    currentContact: Session,
    nextContact: Session,
) {
    const sessionState: Record<string, unknown> = {}
    SESSION_STATE_KEYS.forEach((key) => {
        const value = currentContact[key]
        if (value !== undefined && nextContact[key] === undefined) {
            sessionState[key] = value
        }
    })

    Object.keys(currentContact).forEach((key) => {
        delete (currentContact as unknown as Record<string, unknown>)[key]
    })
    Object.assign(currentContact, nextContact, sessionState)
    return currentContact
}

export function mergeContactListByKind(
    currentContacts: Session[],
    incomingContacts: Session[],
    kind: ContactKind,
) {
    const existingById = new Map<number, Session>()
    currentContacts.forEach((item) => {
        if (isContactKind(item, kind)) {
            existingById.set(getSessionId(item), item)
        }
    })

    const mergedIncoming = incomingContacts.map((item) => {
        const current = existingById.get(getSessionId(item))
        return current ? replaceStaticContactData(current, item) : item
    })

    const friends = kind === 'friend'
        ? mergedIncoming
        : currentContacts.filter((item) => isContactKind(item, 'friend'))
    const groups = kind === 'group'
        ? mergedIncoming
        : currentContacts.filter((item) => isContactKind(item, 'group'))
    const others = currentContacts.filter((item) => {
        return !isContactKind(item, 'friend') && !isContactKind(item, 'group')
    })

    return {
        all: friends.concat(groups, others),
        incoming: mergedIncoming,
    }
}

/**
 * 让真实联系人接管消息早到时创建的占位会话。
 * 返回 true 表示 Map 中的对象引用已替换，调用方需要重建派生会话列表。
 */
export function mergeEarlySessionContacts(
    contacts: Session[],
    sessions: Map<number, Session>,
) {
    let didMerge = false
    contacts.forEach((contact) => {
        const sessionId = getSessionId(contact)
        const currentSession = sessions.get(sessionId)
        if (currentSession && currentSession !== contact) {
            sessions.set(
                sessionId,
                mergeSessionState(contact, currentSession),
            )
            didMerge = true
        }
    })
    return didMerge
}
