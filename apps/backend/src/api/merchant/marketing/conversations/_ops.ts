/**
 * Shared conversation-management helpers for the merchant inbox routes.
 *
 * Every route under /merchant/marketing/conversations goes through these:
 * tenant-scoped loads (a foreign conversation is indistinguishable from a
 * missing one — 404, never a leak), the single serializer used by every
 * mutation response, and the system-message writer used on state transitions.
 */

import { MARKETING_MODULE } from "../../../../modules/marketing"
import type { MerchantCtx } from "../../_helpers"
import { toConversationDto, type ConversationDto } from "./_dto"

/** Handler modes a human may claim a conversation from. */
export const TAKEABLE_HANDLER_MODES = ["ai", "queued"] as const

/** The real conversation statuses (marketing_conversation.status enum). */
export const CONVERSATION_STATUSES = ["open", "snoozed", "closed"] as const
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number]

export const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? v[0] ?? null : v ?? null

/**
 * Load a conversation and assert tenant ownership; null when missing OR owned
 * by another tenant (callers MUST answer 404 for both).
 */
export const loadConversation = async (
  mk: any,
  id: string,
  tenantId: string
): Promise<any | null> => {
  try {
    const row = await mk.retrieveMarketingConversation(id)
    if (!row || row.tenant_id !== tenantId) return null
    return row
  } catch {
    return null
  }
}

const loadContact = async (mk: any, conversation: any): Promise<any | null> => {
  if (!conversation?.contact_id) return null
  try {
    return await mk.retrieveMarketingContact(conversation.contact_id)
  } catch {
    return null
  }
}

const loadPreview = async (mk: any, conversationId: string): Promise<string | null> => {
  try {
    const last = await mk.listMarketingMessages(
      { conversation_id: conversationId },
      { order: { sent_at: "DESC" }, take: 1 }
    )
    return first<any>(last)?.body ?? null
  } catch {
    return null
  }
}

/**
 * Re-read a conversation and serialize it into the SAME shape the inbox list
 * and detail routes return, so every mutation answers { conversation }.
 */
export const serializeConversation = async (
  mk: any,
  id: string,
  tenantId: string,
  fallback?: any
): Promise<ConversationDto> => {
  const row = (await loadConversation(mk, id, tenantId)) ?? fallback
  const contact = await loadContact(mk, row)
  const preview = await loadPreview(mk, id)
  return toConversationDto(row, contact, preview)
}

/** Display name for the acting merchant user, for system-message copy. */
export const actorName = (ctx: MerchantCtx): string =>
  (typeof ctx.merchant?.name === "string" && ctx.merchant.name.trim()) ||
  ctx.merchant?.email ||
  "An agent"

/**
 * Append a `system` message to the thread on a state transition (take-over,
 * return-to-AI, assignment, status change). Written with the same conventions as
 * an ingested message (explicit tenant_id, `sent_at` stamped now), but it does
 * NOT touch last_message_at / unread_count: a system note is not customer
 * activity and must not reorder the inbox or clear a real unread badge.
 * Non-fatal: a failure here never fails the state transition it annotates.
 */
export const writeSystemMessage = async (
  mk: any,
  tenantId: string,
  conversationId: string,
  body: string
): Promise<void> => {
  try {
    await mk.createMarketingMessages({
      tenant_id: tenantId,
      conversation_id: conversationId,
      direction: "outbound",
      author: "system",
      body,
      sent_at: new Date(),
    } as any)
  } catch {
    // Non-fatal.
  }
}

/** Resolve the marketing module service off the request scope. */
export const marketing = (scope: any): any => scope.resolve(MARKETING_MODULE)
