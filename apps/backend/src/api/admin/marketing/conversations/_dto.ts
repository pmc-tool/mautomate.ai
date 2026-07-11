/**
 * The single source of truth for the inbox conversation + message shapes. The
 * inbox UI consumes `ConversationDto` and `MessageDto` exactly, so keep these
 * serializers here and reuse them from every conversations route — never
 * re-shape a conversation / message row inline.
 */

/** A contact as embedded in a conversation row. */
export type ConversationContactDto = {
  id: string
  display_name: string | null
  avatar_url: string | null
  phone: string | null
  email: string | null
  customer_id: string | null
}

/** One inbox thread as the list + detail views consume it. */
export type ConversationDto = {
  id: string
  channel: string
  status: string
  starred: boolean
  unread_count: number
  last_message_at: string | null
  assigned_user_id: string | null
  contact: ConversationContactDto | null
  preview: string | null
}

/** One message inside a thread. */
export type MessageDto = {
  id: string
  direction: string
  author: string
  body: string | null
  media: any
  sent_at: string | null
  delivery_status: string | null
}

/** Coerce a stored date value into an ISO string, or null. */
const toIso = (v: any): string | null => {
  if (!v) {
    return null
  }
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Serialize a marketing_contact row into the embedded contact shape. */
const toContactDto = (contact: any): ConversationContactDto | null => {
  if (!contact) {
    return null
  }
  return {
    id: contact.id,
    display_name: contact.display_name ?? null,
    avatar_url: contact.avatar_url ?? null,
    phone: contact.phone ?? null,
    email: contact.email ?? null,
    customer_id: contact.customer_id ?? null,
  }
}

/** Serialize a marketing_conversation row into the public ConversationDto. */
export const toConversationDto = (
  row: any,
  contact: any,
  preview: string | null
): ConversationDto => ({
  id: row.id,
  channel: row.channel,
  status: row.status,
  starred: Boolean(row.starred),
  unread_count: row.unread_count ?? 0,
  last_message_at: toIso(row.last_message_at),
  assigned_user_id: row.assigned_user_id ?? null,
  contact: toContactDto(contact),
  preview: preview ?? null,
})

/** Serialize a marketing_message row into the public MessageDto. */
export const toMessageDto = (row: any): MessageDto => ({
  id: row.id,
  direction: row.direction,
  author: row.author,
  body: row.body ?? null,
  media: row.media ?? null,
  sent_at: toIso(row.sent_at),
  delivery_status: row.delivery_status ?? null,
})
