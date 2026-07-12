/**
 * auto-reply — the chatbot runtime that turns an inbound customer message into
 * either an AI answer or a human handoff.
 *
 * It is the RUNTIME only. The decision (answer vs handoff) and the prompt
 * grounding live in `../messaging/ai-reply` (`generateAutoReply`, which reuses
 * the same Customer360 + brand context as the inbox's suggest button) and the
 * knowledge retrieval in `../knowledge/rag`. This file owns the things a
 * decision cannot: gating, metering, persistence, delivery, and the handoff
 * state change.
 *
 * ORDER OF GATES (cheapest + safest first — an AI call is only ever made last):
 *   1. The conversation is still owned by the bot   (handler_mode === "ai")
 *   2. A bound chatbot exists, is active, reply_mode === "auto"
 *   3. The customer did not ask for a human         (keyword -> handoff)
 *   4. The tenant is under its daily auto-reply cap (-> handoff)
 *   5. The tenant has AI credits (`meterAction`)    (-> handoff)
 *   6. generateAutoReply -> answer, or handoff (AI unavailable / reply limit)
 *
 * HANDOFF: sets conversation.handler_mode = "queued" + handoff_reason, writes a
 * `system` message so the inbox shows WHY, and sends the customer one holding
 * message on the channel. The bot then stays silent on that thread until a human
 * puts it back into "ai".
 *
 * NO-THROW: called fire-and-forget off the inbound ingest path, so it must never
 * reject (an unhandled rejection would take the process down). Every failure is
 * caught and logged.
 */

import type { MedusaContainer } from "@medusajs/framework/types"

import { withTenant } from "../../../lib/tenant-context"
import { MARKETING_MODULE } from "../index"
import { openCredentials } from "../publish/credentials"
import { meterAction } from "../../platform/integration/metering-guard"
import {
  detectHandoffKeyword,
  generateAutoReply,
  HANDOFF_REASON_LABEL,
} from "./ai-reply"
import type { HandoffReason } from "./ai-reply"
import { getMessagingProvider } from "./registry"
import type { SendResult } from "./types"

/**
 * Per-tenant ceiling on AI auto-replies in one UTC day. An abuse guard, not a
 * billing control (credits are the billing control): it bounds the blast radius
 * of a spam flood or a bot loop on an unmetered instance. Exceeding it queues
 * threads for humans instead of answering them.
 */
export const AUTO_REPLY_DAILY_CAP_PER_TENANT = 500

/** The one message a customer gets when their thread is handed to a human. */
export const HANDOFF_HOLDING_MESSAGE =
  "Connecting you to an agent - someone from our team will reply here shortly."

/** conversation.channel -> social account platform (null = no external account). */
const CHANNEL_PLATFORM: Record<string, string | null> = {
  telegram: "telegram",
  messenger: "facebook",
  instagram: "instagram",
  whatsapp: "whatsapp",
  web_widget: null,
}

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

export type AutoReplyOutcome = {
  status: "replied" | "handoff" | "skipped"
  reason?: string
  messageId?: string
  delivered?: boolean
}

/** Start of the current UTC day — the window the daily cap counts over. */
const startOfUtcDay = (): Date => {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
}

/**
 * Resolve the chatbot that answers a conversation. Prefers the thread's bound
 * `chatbot_id`; otherwise resolves the tenant's bot for that channel via
 * marketing_chatbot_channel and PERSISTS the binding on the conversation so the
 * thread keeps the same bot. Fail closed: a bot from another tenant, an inactive
 * bot, or no binding at all -> null (the bot simply does not answer).
 */
const resolveChatbot = async (
  mk: any,
  tenantId: string,
  conversation: any
): Promise<any | null> => {
  if (conversation.chatbot_id) {
    const bound = await mk
      .retrieveMarketingChatbot(conversation.chatbot_id)
      .catch(() => null)
    if (!bound || bound.tenant_id !== tenantId) {
      return null
    }
    return bound
  }

  const bindings = await mk
    .listMarketingChatbotChannels(
      {
        tenant_id: tenantId,
        channel: conversation.channel,
        active: true,
      },
      { take: 1 }
    )
    .catch(() => [])
  const binding = first(bindings as any[])
  if (!binding?.chatbot_id) {
    return null
  }

  const chatbot = await mk
    .retrieveMarketingChatbot(binding.chatbot_id)
    .catch(() => null)
  if (!chatbot || chatbot.tenant_id !== tenantId) {
    return null
  }

  await mk
    .updateMarketingConversations({
      id: conversation.id,
      chatbot_id: chatbot.id,
    } as any)
    .catch(() => {})

  return chatbot
}

/**
 * Send text to the customer on the conversation's channel. web_widget needs no
 * external send (its provider stores nothing and the widget polls the thread);
 * an unconnected channel degrades to `no_channel_credential` — the message is
 * still persisted, exactly as the inbox reply route behaves.
 */
const deliverToChannel = async (
  mk: any,
  tenantId: string,
  conversation: any,
  text: string
): Promise<SendResult> => {
  const channel = conversation.channel as string
  const hasMapping = Object.prototype.hasOwnProperty.call(
    CHANNEL_PLATFORM,
    channel
  )
  if (!hasMapping) {
    return { ok: false, deliveryStatus: "no_channel_credential" }
  }

  const provider = getMessagingProvider(channel)
  if (!provider) {
    return { ok: false, deliveryStatus: "no_channel_credential" }
  }

  let credentials: { accessToken: string | null; meta: Record<string, any> | null } =
    { accessToken: null, meta: null }

  const platform = CHANNEL_PLATFORM[channel]
  if (platform !== null) {
    const account = first(
      await mk
        .listMarketingSocialAccounts({ tenant_id: tenantId, platform })
        .catch(() => [])
    )
    if (!account) {
      return { ok: false, deliveryStatus: "no_channel_credential" }
    }
    const creds = await openCredentials(mk, tenantId, account.id).catch(
      () => null
    )
    if (!creds?.accessToken) {
      return { ok: false, deliveryStatus: "no_channel_credential" }
    }
    credentials = { accessToken: creds.accessToken, meta: creds.meta }
  }

  try {
    return await provider.sendMessage({
      channel: channel as any,
      externalThreadId: conversation.external_thread_id ?? "",
      credentials,
      text,
      media: [],
    })
  } catch (e: any) {
    return {
      ok: false,
      deliveryStatus: "failed",
      error: { message: e?.message ?? "send failed", retryable: false },
    }
  }
}

/** Persist an outbound message on the thread and refresh its activity. */
const persistOutbound = async (
  mk: any,
  tenantId: string,
  conversation: any,
  input: {
    body: string
    author: "ai" | "system"
    deliveryStatus?: string | null
    externalMessageId?: string | null
    /** Whether this message clears the merchant's unread badge. */
    clearsUnread: boolean
  }
): Promise<any> => {
  const sentAt = new Date()
  const created = await mk.createMarketingMessages({
    tenant_id: tenantId,
    conversation_id: conversation.id,
    direction: "outbound",
    author: input.author,
    body: input.body,
    external_message_id: input.externalMessageId ?? null,
    delivery_status: input.deliveryStatus ?? null,
    sent_at: sentAt,
  } as any)

  const update: Record<string, any> = {
    id: conversation.id,
    last_message_at: sentAt,
  }
  if (input.clearsUnread) {
    // The bot handled the thread; nothing is waiting on a human.
    update.unread_count = 0
  }
  await mk.updateMarketingConversations(update as any)

  return first(created)
}

/**
 * Hand the thread to a human: queue it, record why, tell the customer once.
 * Idempotent enough for the ingest path — a thread already in `queued`/`human`
 * never reaches here (gate 1).
 */
const handoff = async (
  container: MedusaContainer,
  mk: any,
  tenantId: string,
  conversation: any,
  reason: HandoffReason
): Promise<AutoReplyOutcome> => {
  await mk
    .updateMarketingConversations({
      id: conversation.id,
      handler_mode: "queued",
      handoff_reason: reason,
    } as any)
    .catch(() => {})

  // The inbox needs to see WHY the bot stepped back.
  await persistOutbound(mk, tenantId, conversation, {
    body: `Handed to a human agent: ${HANDOFF_REASON_LABEL[reason]}`,
    author: "system",
    deliveryStatus: "internal",
    // A queued thread IS waiting on a human — keep the unread badge.
    clearsUnread: false,
  }).catch(() => null)

  const sent = await deliverToChannel(
    mk,
    tenantId,
    conversation,
    HANDOFF_HOLDING_MESSAGE
  )
  await persistOutbound(mk, tenantId, conversation, {
    body: HANDOFF_HOLDING_MESSAGE,
    author: "system",
    deliveryStatus: sent.ok ? sent.deliveryStatus ?? "sent" : sent.deliveryStatus ?? "failed",
    externalMessageId: sent.externalMessageId ?? null,
    clearsUnread: false,
  }).catch(() => null)

  return { status: "handoff", reason, delivered: sent.ok }
}

/** Count this tenant's AI-authored messages since 00:00 UTC (the daily cap). */
const aiRepliesToday = async (mk: any, tenantId: string): Promise<number> => {
  const [, count] = await mk
    .listAndCountMarketingMessages(
      {
        tenant_id: tenantId,
        author: "ai",
        sent_at: { $gte: startOfUtcDay() },
      },
      { take: 1 }
    )
    .catch(() => [[], 0])
  return count ?? 0
}

/**
 * The chatbot's turn: decide and act on one inbound customer message.
 *
 * Returns an outcome for tests/callers; NEVER throws and NEVER rejects, so the
 * webhook path can fire-and-forget it. `messageId` is the inbound message's id —
 * it keys the metering idempotency, so a redelivered webhook cannot double-charge
 * the tenant for the same reply.
 */
export const handleInboundAutoReply = async (
  container: MedusaContainer,
  input: {
    tenantId: string
    conversationId: string
    /** The inbound message that triggered this turn (metering idempotency key). */
    messageId: string
    text: string | null
  }
): Promise<AutoReplyOutcome> => {
  try {
    return await withTenant(input.tenantId, async () => {
      const mk: any = container.resolve(MARKETING_MODULE)

      const conversation = await mk
        .retrieveMarketingConversation(input.conversationId)
        .catch(() => null)
      // FAIL CLOSED: never act on another tenant's thread.
      if (!conversation || conversation.tenant_id !== input.tenantId) {
        return { status: "skipped", reason: "conversation_not_found" }
      }

      // (1) A human owns the thread (or it is already queued) -> stay silent.
      if (conversation.handler_mode !== "ai") {
        return { status: "skipped", reason: "handler_mode_not_ai" }
      }

      // (2) A bot must be bound, active, and set to reply automatically.
      const chatbot = await resolveChatbot(mk, input.tenantId, conversation)
      if (!chatbot) {
        return { status: "skipped", reason: "no_chatbot" }
      }
      if (!chatbot.active) {
        return { status: "skipped", reason: "chatbot_inactive" }
      }
      if (chatbot.reply_mode !== "auto") {
        return { status: "skipped", reason: "reply_mode_draft" }
      }

      // (3) "Get me a human" short-circuits before any AI spend.
      if (detectHandoffKeyword(input.text)) {
        return await handoff(
          container,
          mk,
          input.tenantId,
          conversation,
          "requested_human"
        )
      }

      // (4) Abuse guard: the tenant's daily auto-reply ceiling.
      const today = await aiRepliesToday(mk, input.tenantId)
      if (today >= AUTO_REPLY_DAILY_CAP_PER_TENANT) {
        return await handoff(
          container,
          mk,
          input.tenantId,
          conversation,
          "daily_cap"
        )
      }

      // (5)+(6) Credits gate the AI call; the decision comes back from ai-reply.
      const metered = await meterAction(
        container,
        input.tenantId,
        "ai_text",
        1,
        async () => {
          const decision = await generateAutoReply(container, {
            conversationId: input.conversationId,
            tenantId: input.tenantId,
            chatbot,
            inboundText: input.text,
          })
          // A handoff never reached the model — do not bill for it.
          return {
            result: decision,
            actualUnits: decision.action === "reply" ? 1 : 0,
          }
        },
        { idempotencyKey: `marketing_auto_reply:${input.messageId}` }
      )

      if (!metered.ok) {
        return await handoff(
          container,
          mk,
          input.tenantId,
          conversation,
          "out_of_credits"
        )
      }

      const decision = metered.result
      if (decision.action === "handoff") {
        return await handoff(
          container,
          mk,
          input.tenantId,
          conversation,
          decision.reason
        )
      }

      // The bot answers: deliver on the channel, then record it on the thread.
      const sent = await deliverToChannel(
        mk,
        input.tenantId,
        conversation,
        decision.text
      )
      const message = await persistOutbound(mk, input.tenantId, conversation, {
        body: decision.text,
        author: "ai",
        deliveryStatus: sent.ok
          ? sent.deliveryStatus ?? "sent"
          : sent.deliveryStatus ?? "failed",
        externalMessageId: sent.externalMessageId ?? null,
        clearsUnread: true,
      })

      return {
        status: "replied",
        messageId: message?.id,
        delivered: sent.ok,
      }
    })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error(
      `[marketing-auto-reply] failed for conversation ${input.conversationId}: ${
        e?.message ?? e
      }`
    )
    return { status: "skipped", reason: "error" }
  }
}
