/**
 * Merchant inbox serializers — the single source of truth for the conversation
 * and message shapes the merchant social manager consumes. Kept local to the
 * merchant tree so it can never leak internal columns.
 */

export type ConversationContactDto = {
  id: string
  display_name: string | null
  avatar_url: string | null
  phone: string | null
  email: string | null
  customer_id: string | null
}

export type ConversationDto = {
  id: string
  channel: string
  status: string
  handler_mode: string
  handoff_reason: string | null
  chatbot_id: string | null
  starred: boolean
  unread_count: number
  last_message_at: string | null
  assigned_user_id: string | null
  contact: ConversationContactDto | null
  preview: string | null
}

export type InboxNoteDto = {
  id: string
  conversation_id: string
  author_id: string
  content: string
  created_at: string | null
}

export type CannedResponseDto = {
  id: string
  shortcut: string
  title: string
  content: string
  category: string | null
  created_at: string | null
  updated_at: string | null
}

export type MessageDto = {
  id: string
  direction: string
  author: string
  body: string | null
  media: any
  sent_at: string | null
  delivery_status: string | null
}

const toIso = (v: any): string | null => {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const toContactDto = (contact: any): ConversationContactDto | null => {
  if (!contact) return null
  return {
    id: contact.id,
    display_name: contact.display_name ?? null,
    avatar_url: contact.avatar_url ?? null,
    phone: contact.phone ?? null,
    email: contact.email ?? null,
    customer_id: contact.customer_id ?? null,
  }
}

export const toConversationDto = (
  row: any,
  contact: any,
  preview: string | null
): ConversationDto => ({
  id: row.id,
  channel: row.channel,
  status: row.status,
  handler_mode: row.handler_mode ?? "ai",
  handoff_reason: row.handoff_reason ?? null,
  chatbot_id: row.chatbot_id ?? null,
  starred: Boolean(row.starred),
  unread_count: row.unread_count ?? 0,
  last_message_at: toIso(row.last_message_at),
  assigned_user_id: row.assigned_user_id ?? null,
  contact: toContactDto(contact),
  preview: preview ?? null,
})

export const toMessageDto = (row: any): MessageDto => ({
  id: row.id,
  direction: row.direction,
  author: row.author,
  body: row.body ?? null,
  media: row.media ?? null,
  sent_at: toIso(row.sent_at),
  delivery_status: row.delivery_status ?? null,
})

export const toInboxNoteDto = (row: any): InboxNoteDto => ({
  id: row.id,
  conversation_id: row.conversation_id,
  author_id: row.author_id,
  content: row.content,
  created_at: toIso(row.created_at),
})

export const toCannedResponseDto = (row: any): CannedResponseDto => ({
  id: row.id,
  shortcut: row.shortcut,
  title: row.title,
  content: row.content,
  category: row.category ?? null,
  created_at: toIso(row.created_at),
  updated_at: toIso(row.updated_at),
})
