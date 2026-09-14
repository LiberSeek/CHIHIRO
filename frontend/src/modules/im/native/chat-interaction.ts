export interface ForwardContact {
  user_id?: number | string
  group_id?: number | string
}

export function hasOutgoingContent({ text, attachmentCount, hasInlineFaces, hasInlineAts }: {
  text: string
  attachmentCount: number
  hasInlineFaces: boolean
  hasInlineAts: boolean
}): boolean {
  return text !== '' || attachmentCount > 0 || hasInlineFaces || hasInlineAts
}

export function forwardContactKey(contact: ForwardContact): string {
  return contact.user_id ? `user-${contact.user_id}` : `group-${contact.group_id}`
}

export function prioritizeForwardContacts<T extends ForwardContact>(contacts: readonly T[], recentContacts: readonly T[]): T[] {
  const recentKeys = new Set(recentContacts.map(forwardContactKey))
  return [
    ...recentContacts.filter((contact) => contacts.some((item) => forwardContactKey(item) === forwardContactKey(contact))),
    ...contacts.filter((contact) => !recentKeys.has(forwardContactKey(contact))),
  ]
}
