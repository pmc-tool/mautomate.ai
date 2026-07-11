import crypto from "crypto"
import {
  getCurrentTenantId,
  resolveTenantId,
  withTenant,
} from "../../../lib/tenant-context"
/**
 * Idempotent inbound ingest — the ONE path a verified inbound message takes to
 * become a contact + conversation + message. Every webhook handler and the web
 * widget call `ingestInbound`. Idempotency is layered:
 *   1. webhook_event.external_event_id (tenant-unique) drops duplicate deliveries
 *   2. message.external_message_id (tenant-unique) drops duplicate messages
 *   3. conversation (tenant, channel, external_thread_id) (unique) prevents
 *      thread forks
 * The unique DB indexes are the real guarantee; the pre-checks here just avoid
 * the error path on the common case.
 *
 * MULTI-TENANT ATTRIBUTION (fail closed): inbound platform webhooks are PUBLIC —
 * the sender provides no tenant. The RECEIVING account identifies the store, so
 * before writing anything we resolve the owning tenant from the receiving
 * account (Meta Page/IG/WABA id, or Telegram bot secret) via
 * marketing_social_account, then wrap the ENTIRE per-message ingest in
 * `withTenant(...)` so every write lands under the correct store. A message we
 * cannot attribute is DROPPED — it is NEVER written to a shared/default tenant.
 * Session channels (web_widget) carry no receiving account and keep resolving
 * their tenant from the request context (the web-widget route gates them by a
 * conversation token upstream).
 */

import type { MedusaContainer } from "@medusajs/framework/types"
import { MARKETING_MODULE } from "../index"
import type { InboundMessage } from "./types"

/**
 * External messaging channel → marketing_social_account.platform. Channels
 * absent from this map (web_widget, email, review) have NO external receiving
 * account and resolve their tenant from the request context instead.
 */
const CHANNEL_TO_SOCIAL_PLATFORM: Record<string, string | undefined> = {
  messenger: "facebook",
  instagram: "instagram",
  whatsapp: "whatsapp",
  telegram: "telegram",
}

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

/** Timing-safe utf8 string compare; false on any length mismatch. */
const timingSafeStrEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")
  if (bufA.length === 0 || bufA.length !== bufB.length) {
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}

/** Return the single owning tenant across matched accounts, or null if the
 *  match is empty or ambiguous (spans more than one tenant). */
const singleTenant = (accounts: any[]): string | null => {
  const tenantIds = Array.from(
    new Set((accounts ?? []).map((a) => a?.tenant_id).filter(Boolean))
  )
  return tenantIds.length === 1 ? (tenantIds[0] as string) : null
}

/**
 * Resolve the receiving Telegram bot's tenant from the per-bot webhook secret.
 * Telegram updates carry no stable receiving-account id in the payload, so the
 * bot is identified by the `x-telegram-bot-api-secret-token` it was registered
 * with, stored on the account as meta.webhook_secret. Fail closed: no stored
 * secret matches -> null (drop).
 */
const resolveTelegramTenantId = async (
  mk: any,
  msg: InboundMessage
): Promise<string | null> => {
  const secret = msg.receivingAccountSecret
  if (!secret) {
    return null
  }
  let accounts: any[] = []
  try {
    accounts = await mk.listMarketingSocialAccounts({ platform: "telegram" })
  } catch {
    return null
  }
  const matches = (accounts ?? []).filter((a) => {
    const s = a?.meta?.webhook_secret
    return typeof s === "string" && s.length > 0 && timingSafeStrEqual(s, secret)
  })
  return singleTenant(matches)
}

/**
 * Resolve the OWNING tenant for an inbound message from its RECEIVING account.
 * Returns the tenant id, or `null` when the message cannot be safely attributed
 * (unknown/disconnected receiving account, or an ambiguous cross-tenant match).
 * The caller MUST drop a `null`: inbound customer PII is never written to a
 * shared/default tenant.
 */
const resolveInboundTenantId = async (
  mk: any,
  msg: InboundMessage
): Promise<string | null> => {
  const platform = CHANNEL_TO_SOCIAL_PLATFORM[msg.channel]

  // Session channels (web_widget, email, review): no external receiving
  // account. Preserve existing behavior — tenant from the request context, else
  // the configured default. These paths are gated upstream (e.g. the web-widget
  // route validates a conversation token), not by a signature here.
  if (!platform) {
    return getCurrentTenantId() ?? resolveTenantId("MARKETING_DEFAULT_TENANT")
  }

  if (platform === "telegram") {
    return resolveTelegramTenantId(mk, msg)
  }

  // Meta family (messenger/instagram/whatsapp): the receiving Page / IG / WABA
  // id maps to exactly one connected account, whose tenant owns the message.
  const externalId = msg.receivingAccountExternalId
  if (!externalId) {
    return null
  }
  let accounts: any[] = []
  try {
    accounts = await mk.listMarketingSocialAccounts({
      platform,
      external_id: externalId,
    })
  } catch {
    return null
  }
  return singleTenant(accounts)
}

export type IngestResult = {
  skipped: boolean
  reason?: "duplicate_event" | "duplicate_message" | "no_tenant"
  conversationId?: string
  contactId?: string
  messageId?: string
}

/** Find-or-create the contact behind a sender on a channel. Runs inside the
 *  resolved tenant's `withTenant` scope, so the tenant id is read from context. */
const upsertContact = async (
  mk: any,
  tenantId: string,
  msg: InboundMessage
): Promise<any> => {
  // Prefer an existing contact reachable via a prior conversation on this
  // thread; otherwise create one. (Contact identity is best-effort — the
  // conversation is the durable thread key.)
  const created = await mk.createMarketingContacts({
    tenant_id: tenantId,
    display_name: msg.senderName ?? null,
    avatar_url: msg.senderAvatar ?? null,
    primary_channel: msg.channel,
    phone: msg.senderPhone ?? null,
    email: msg.senderEmail ?? null,
    meta: { external_ids: { [msg.channel]: msg.senderExternalId } },
  } as any)
  return first(created)
}

/** Find-or-create the conversation for a thread. */
const upsertConversation = async (
  mk: any,
  tenantId: string,
  msg: InboundMessage
): Promise<any> => {
  const existing = await mk.listMarketingConversations({
    tenant_id: tenantId,
    channel: msg.channel,
    external_thread_id: msg.externalThreadId,
  })
  const prior = first(existing)
  if (prior) {
    return prior
  }
  const contact = await upsertContact(mk, tenantId, msg)
  const created = await mk.createMarketingConversations({
    tenant_id: tenantId,
    channel: msg.channel,
    external_thread_id: msg.externalThreadId,
    contact_id: contact?.id ?? null,
    status: "open",
    last_message_at: msg.sentAt,
    unread_count: 0,
  } as any)
  return first(created)
}

/**
 * Ingest a single, already-tenant-resolved message. Runs inside the tenant's
 * `withTenant` scope; every write is stamped with `tenantId`.
 */
const ingestOne = async (
  mk: any,
  tenantId: string,
  msg: InboundMessage
): Promise<IngestResult> => {
  // (1) Event-level idempotency (tenant-scoped).
  const seen = await mk.listMarketingWebhookEvents({
    tenant_id: tenantId,
    external_event_id: msg.externalEventId,
  })
  if (first(seen)) {
    return { skipped: true, reason: "duplicate_event" }
  }
  await mk.createMarketingWebhookEvents({
    tenant_id: tenantId,
    channel: msg.channel,
    external_event_id: msg.externalEventId,
    payload: { thread: msg.externalThreadId, message: msg.externalMessageId },
  } as any)

  // (2) Message-level idempotency (tenant-scoped).
  if (msg.externalMessageId) {
    const dupe = await mk.listMarketingMessages({
      tenant_id: tenantId,
      external_message_id: msg.externalMessageId,
    })
    if (first(dupe)) {
      return { skipped: true, reason: "duplicate_message" }
    }
  }

  // (3) Thread → conversation → message.
  const conversation = await upsertConversation(mk, tenantId, msg)
  const createdMsg = await mk.createMarketingMessages({
    tenant_id: tenantId,
    conversation_id: conversation.id,
    direction: "inbound",
    author: "contact",
    body: msg.text ?? null,
    media: msg.media?.length ? msg.media : null,
    external_message_id: msg.externalMessageId ?? null,
    sent_at: msg.sentAt,
  } as any)
  const message = first(createdMsg)

  // Bump conversation activity + unread.
  await mk.updateMarketingConversations({
    id: conversation.id,
    last_message_at: msg.sentAt,
    unread_count: (conversation.unread_count ?? 0) + 1,
    status: conversation.status === "closed" ? "open" : conversation.status,
  } as any)

  // Stamp the event processed.
  const evRows = await mk.listMarketingWebhookEvents({
    tenant_id: tenantId,
    external_event_id: msg.externalEventId,
  })
  const ev = first(evRows)
  if (ev?.id) {
    await mk.updateMarketingWebhookEvents({
      id: ev.id,
      processed_at: msg.sentAt,
    } as any)
  }

  return {
    skipped: false,
    conversationId: conversation.id,
    contactId: conversation.contact_id ?? undefined,
    messageId: message?.id,
  }
}

/**
 * Ingest a batch of verified inbound messages. Returns one result per input,
 * in order. Never throws — a bad message yields a skipped result so a poisoned
 * item can't stall a webhook batch. Each message is attributed to its owning
 * tenant from the RECEIVING account and ingested inside that tenant's context;
 * an unattributable message is DROPPED (skipped, reason "no_tenant") rather than
 * written to a shared/default tenant.
 */
export const ingestInbound = async (
  container: MedusaContainer,
  messages: InboundMessage[]
): Promise<IngestResult[]> => {
  const mk: any = container.resolve(MARKETING_MODULE)
  const results: IngestResult[] = []

  for (const msg of messages) {
    try {
      const tenantId = await resolveInboundTenantId(mk, msg)
      if (!tenantId) {
        // FAIL CLOSED: no owning tenant for this receiving account. Drop the
        // message — never write inbound PII to a shared/default tenant.
        // eslint-disable-next-line no-console
        console.warn(
          `[marketing-inbound] dropping ${msg.channel} message: no connected account for receiving id=${
            msg.receivingAccountExternalId ?? "(none)"
          }`
        )
        results.push({ skipped: true, reason: "no_tenant" })
        continue
      }

      const result = await withTenant(tenantId, () =>
        ingestOne(mk, tenantId, msg)
      )
      results.push(result)
    } catch (e) {
      // No-throw: record a skip so the batch continues.
      results.push({ skipped: true })
    }
  }

  return results
}

/**
 * Append an OUTBOUND message (agent or AI reply) to a conversation and refresh
 * its activity. Used by the inbox reply route and the web-widget send path. The
 * caller is already inside the tenant's context (authenticated inbox routes), so
 * the tenant id is read from context.
 */
export const recordOutboundMessage = async (
  container: MedusaContainer,
  input: {
    conversationId: string
    body: string | null
    author: "agent" | "ai" | "system"
    media?: any[] | null
    externalMessageId?: string | null
    deliveryStatus?: string | null
    sentAt?: Date
  }
): Promise<any> => {
  const mk: any = container.resolve(MARKETING_MODULE)
  const tenantId = getCurrentTenantId() ?? resolveTenantId("MARKETING_DEFAULT_TENANT")
  const sentAt = input.sentAt ?? new Date()
  const created = await mk.createMarketingMessages({
    tenant_id: tenantId,
    conversation_id: input.conversationId,
    direction: "outbound",
    author: input.author,
    body: input.body ?? null,
    media: input.media?.length ? input.media : null,
    external_message_id: input.externalMessageId ?? null,
    delivery_status: input.deliveryStatus ?? null,
    sent_at: sentAt,
  } as any)
  // An agent reply clears the unread counter.
  await mk.updateMarketingConversations({
    id: input.conversationId,
    last_message_at: sentAt,
    unread_count: 0,
  } as any)
  return first(created)
}
