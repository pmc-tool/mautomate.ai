import {
  getCurrentTenantId,
  resolveTenantId,
} from "../../../lib/tenant-context"
/**
 * ai-reply — the grounded reply engine behind the inbox.
 *
 * Three jobs, all no-throw so they can run on the live request path:
 *   1. `buildCustomer360` resolves a commerce snapshot for a contact (the
 *      matched customer + their order history) through the CommerceGateway, so
 *      an agent (or the AI) can see who they are talking to.
 *   2. `suggestReply` drafts an on-brand customer-service reply grounded in the
 *      recent thread + the Customer360 facts, with a hard rule never to invent
 *      order / shipping details not present in the grounding. Drafted only —
 *      a human sends it.
 *   3. `generateAutoReply` decides what a CHATBOT should do with an inbound
 *      message: hand off to a human, or answer. It reuses exactly the same
 *      grounding as `suggestReply` (`loadReplyGrounding` + `buildReplySystem`,
 *      shared by both — the Customer360 + brand-context logic is written once)
 *      and adds the bot's persona (instructions / scope lock / language) plus
 *      the top-k knowledge retrieved from its trained sources (`knowledge/rag`).
 *      It performs NO side effects: it returns a DECISION. `messaging/auto-reply`
 *      owns the runtime (gating, metering, persistence, delivery, handoff).
 *
 * NO-THROW: a gateway failure degrades Customer360 to `matched:false`; a missing
 * or failing AI provider degrades the suggestion to an empty string and the
 * auto-reply to a `handoff` decision. Neither ever throws — the inbox stays up
 * even when commerce or AI is unavailable.
 */

import type { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from "../index"
import { getCommerceGateway } from "../gateway"
import type { CommerceCustomer, CommerceOrder } from "../gateway"
import { getAiTextProvider } from "../ai/registry"
import { buildBrandContext } from "../content/brand-context"
import { retrieveContext } from "../knowledge/rag"

const currentTenantId = (): string =>
  getCurrentTenantId() ?? resolveTenantId("MARKETING_DEFAULT_TENANT")

/** A single order line in the Customer360 snapshot. */
export type Customer360Order = {
  id: string
  display_id: number | null
  total: number
  currency_code: string | null
  status: string | null
  created_at: string | null
}

/** The commerce snapshot for the contact behind a conversation. */
export type Customer360 = {
  matched: boolean
  customer: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    has_account: boolean
  } | null
  order_count: number
  total_spent: number
  currency_code: string | null
  recent_orders: Customer360Order[]
}

const EMPTY_360: Customer360 = {
  matched: false,
  customer: null,
  order_count: 0,
  total_spent: 0,
  currency_code: null,
  recent_orders: [],
}

/** Join a customer's names into a single display name, or null. */
const customerName = (c: CommerceCustomer): string | null => {
  const name = [c.first_name, c.last_name]
    .filter((p) => typeof p === "string" && p.trim().length > 0)
    .join(" ")
    .trim()
  return name.length > 0 ? name : null
}

/** Newest-first sort key for an order (epoch ms; missing dates sort last). */
const orderTime = (o: CommerceOrder): number => {
  const t = o.created_at ? Date.parse(o.created_at) : NaN
  return Number.isNaN(t) ? 0 : t
}

/**
 * Resolve the Customer360 for a contact. Prefers a linked `customer_id`; falls
 * back to a phone match; otherwise returns an unmatched snapshot. Never throws —
 * any gateway failure yields `matched:false`.
 */
export const buildCustomer360 = async (
  container: MedusaContainer,
  contact: any
): Promise<Customer360> => {
  if (!contact) {
    return { ...EMPTY_360 }
  }

  try {
    const gateway = getCommerceGateway(container)

    let customer: CommerceCustomer | null = null
    let orders: CommerceOrder[] = []

    if (contact.customer_id) {
      customer = await gateway.getCustomer(currentTenantId(), contact.customer_id)
      const all = await gateway.queryOrders(currentTenantId(), { limit: 200 })
      orders = all.filter((o) => o.customer_id === contact.customer_id)
    } else if (contact.phone) {
      const matches = await gateway.findCustomersByPhone(
        currentTenantId(),
        contact.phone
      )
      customer = matches[0] ?? null
      if (customer) {
        const all = await gateway.queryOrders(currentTenantId(), { limit: 200 })
        orders = all.filter(
          (o) =>
            o.customer_id === customer!.id || o.phone === contact.phone
        )
      }
    }

    if (!customer) {
      return { ...EMPTY_360 }
    }

    const sorted = [...orders].sort((a, b) => orderTime(b) - orderTime(a))
    const totalSpent = sorted.reduce(
      (sum, o) => sum + (typeof o.total === "number" ? o.total : 0),
      0
    )
    const currencyCode =
      sorted.find((o) => o.currency_code)?.currency_code ?? null

    return {
      matched: true,
      customer: {
        id: customer.id,
        name: customerName(customer),
        email: customer.email ?? null,
        phone: customer.phone ?? null,
        has_account: Boolean(customer.has_account),
      },
      order_count: sorted.length,
      total_spent: totalSpent,
      currency_code: currencyCode,
      recent_orders: sorted.slice(0, 5).map((o) => ({
        id: o.id,
        display_id: o.display_id ?? null,
        total: typeof o.total === "number" ? o.total : 0,
        currency_code: o.currency_code ?? null,
        status: o.status ?? null,
        created_at: o.created_at ?? null,
      })),
    }
  } catch {
    // No-throw: a commerce failure means we simply cannot enrich the contact.
    return { ...EMPTY_360 }
  }
}

/** Render the Customer360 as compact grounding facts for the system prompt. */
const customer360Facts = (c360: Customer360): string => {
  if (!c360.matched || !c360.customer) {
    return (
      "Customer match: none. This contact is not linked to a known customer " +
      "or order. Do not reference any specific order, total, or shipping status."
    )
  }
  const lines: string[] = []
  lines.push("Customer match: yes. Facts you may reference (do not go beyond these):")
  const cust = c360.customer
  lines.push(
    `- Customer: ${cust.name ?? "unknown name"}${
      cust.email ? ` <${cust.email}>` : ""
    }${cust.phone ? ` (${cust.phone})` : ""}, ${
      cust.has_account ? "has an account" : "guest checkout"
    }.`
  )
  lines.push(
    `- Orders: ${c360.order_count} total${
      c360.currency_code
        ? `, ${c360.total_spent} ${c360.currency_code.toUpperCase()} spent`
        : ""
    }.`
  )
  for (const o of c360.recent_orders) {
    const ref = o.display_id ? `#${o.display_id}` : o.id
    const cur = o.currency_code ? ` ${o.currency_code.toUpperCase()}` : ""
    const when = o.created_at ? ` on ${o.created_at.slice(0, 10)}` : ""
    lines.push(
      `- Order ${ref}: total ${o.total}${cur}, status ${
        o.status ?? "unknown"
      }${when}.`
    )
  }
  return lines.join("\n")
}

/** Render the recent thread as a plain transcript for the generation prompt. */
const threadTranscript = (messages: any[]): string => {
  if (!messages.length) {
    return "(no prior messages)"
  }
  return messages
    .map((m) => {
      const who =
        m.direction === "inbound"
          ? "Customer"
          : m.author === "ai"
          ? "Assistant"
          : "Agent"
      const body = (m.body ?? "").toString().trim()
      const media =
        !body && Array.isArray(m.media) && m.media.length
          ? "[sent an attachment]"
          : ""
      return `${who}: ${body || media}`
    })
    .join("\n")
}

/**
 * The one hard grounding rule shared by every generated reply (draft or auto):
 * never invent commerce facts that are not in the grounding.
 */
const GROUNDING_RULE =
  "HARD RULE: Never invent or guess order numbers, totals, tracking numbers, " +
  "delivery dates, shipping status, refunds, or stock. Only reference order or " +
  "customer details that appear in the CUSTOMER FACTS or the conversation " +
  "below. If the customer asks for a detail you do not have, say you will " +
  "check and follow up rather than fabricating it."

/** The shared grounding for a conversation: the thread + the Customer360. */
export type ReplyGrounding = {
  conversation: any
  /** Oldest-first, ready for `threadTranscript`. */
  history: any[]
  c360: Customer360
}

/**
 * Load everything a generated reply is grounded in: the conversation (verified
 * against the tenant — fail closed), its recent thread, and the Customer360 of
 * the contact behind it. Shared by `suggestReply` and `generateAutoReply` so the
 * grounding is defined exactly once. Returns null when the conversation does not
 * exist in this tenant.
 */
export const loadReplyGrounding = async (
  container: MedusaContainer,
  input: {
    conversationId: string
    tenantId: string
    historyLimit?: number
    /** Drop `system` messages (handoff notices etc.) from the transcript. */
    excludeSystem?: boolean
  }
): Promise<ReplyGrounding | null> => {
  const mk: any = container.resolve(MARKETING_MODULE)

  const conversation = await mk
    .retrieveMarketingConversation(input.conversationId)
    .catch(() => null)
  if (!conversation || conversation.tenant_id !== input.tenantId) {
    return null
  }

  // Newest-first from the store, flipped to chronological for the transcript.
  const recent = await mk
    .listMarketingMessages(
      { conversation_id: input.conversationId },
      { order: { sent_at: "DESC" }, take: input.historyLimit ?? 15 }
    )
    .catch(() => [])
  let history = [...(recent ?? [])].reverse()
  if (input.excludeSystem) {
    history = history.filter((m: any) => m.author !== "system")
  }

  let contact: any = null
  if (conversation.contact_id) {
    contact = await mk
      .retrieveMarketingContact(conversation.contact_id)
      .catch(() => null)
  }

  const c360 = await buildCustomer360(container, contact)

  return { conversation, history, c360 }
}

/**
 * Assemble the system prompt every generated reply shares: brand voice, the
 * persona, the Customer360 facts, any extra sections (bot persona / retrieved
 * knowledge), and the hard grounding rule — in that order.
 */
export const buildReplySystem = async (
  container: MedusaContainer,
  tenantId: string,
  input: { persona: string; c360: Customer360; sections?: string[] }
): Promise<string> => {
  const brand = await buildBrandContext(container, tenantId, {}).catch(() => "")
  return [
    brand,
    input.persona,
    "CUSTOMER FACTS:\n" + customer360Facts(input.c360),
    ...(input.sections ?? []).filter((s) => s && s.trim().length > 0),
    GROUNDING_RULE,
  ]
    .filter((s) => s && s.trim().length > 0)
    .join("\n\n")
}

const SUGGEST_PERSONA =
  "You are a helpful, warm customer-service agent replying on behalf of the " +
  "brand inside a messaging inbox. Write a single concise reply (1-3 short " +
  "sentences) in the brand's voice, addressed directly to the customer. Do " +
  "not include a subject line, signature, or quotation marks around the reply."

/**
 * Draft an on-brand reply for a conversation, grounded in the recent thread and
 * the Customer360 facts. Returns `{ suggestion, needs_ai }`:
 *   - `needs_ai:true` with an empty suggestion when no AI provider is configured
 *     (the UI should surface a "configure AI" hint).
 *   - `needs_ai:false` with the drafted suggestion otherwise. A generation
 *     failure degrades to an empty suggestion (still `needs_ai:false`).
 * Never throws.
 */
export const suggestReply = async (
  container: MedusaContainer,
  input: { conversationId: string; tenantId: string }
): Promise<{ suggestion: string; needs_ai: boolean }> => {
  try {
    const grounding = await loadReplyGrounding(container, {
      conversationId: input.conversationId,
      tenantId: input.tenantId,
      historyLimit: 15,
    })
    if (!grounding) {
      return { suggestion: "", needs_ai: true }
    }

    const provider = getAiTextProvider()
    if (!provider) {
      return { suggestion: "", needs_ai: true }
    }

    const system = await buildReplySystem(container, input.tenantId, {
      persona: SUGGEST_PERSONA,
      c360: grounding.c360,
    })

    const prompt =
      "Recent conversation (oldest first):\n" +
      threadTranscript(grounding.history) +
      "\n\nDraft the brand's next reply to the customer now."

    const raw = await provider.generate(prompt, {
      system,
      temperature: 0.4,
    })

    return { suggestion: (raw ?? "").toString().trim(), needs_ai: false }
  } catch {
    // No-throw: an AI/store failure degrades to an empty (but attempted) draft.
    return { suggestion: "", needs_ai: false }
  }
}

// --- Chatbot auto-reply ------------------------------------------------------

/**
 * Phrases that mean "I want a human". Matched case-insensitively as substrings
 * of the inbound text; a hit short-circuits the bot and queues the thread for an
 * agent WITHOUT generating an answer (nothing is more annoying than a bot
 * answering a request to escalate).
 */
export const HANDOFF_KEYWORDS: readonly string[] = [
  "talk to human",
  "talk to a human",
  "speak to a human",
  "speak to human",
  "real person",
  "real human",
  "human agent",
  "live agent",
  "talk to an agent",
  "speak to an agent",
  "talk to agent",
  "speak to agent",
  "talk to someone",
  "speak to someone",
  "customer service rep",
  "representative",
  "operator",
  "agent please",
  "human please",
  "connect me to",
  "transfer me to",
  "escalate",
  "supervisor",
  "manager",
]

/** Max AI-authored messages one conversation gets before a human takes over. */
export const MAX_AI_MESSAGES_PER_CONVERSATION = 10

/** Why the bot stopped answering and queued the thread for a human. */
export type HandoffReason =
  | "requested_human"
  | "ai_message_limit"
  | "ai_unavailable"
  | "out_of_credits"
  | "daily_cap"

/** Human-readable handoff reasons (persisted + shown in the inbox). */
export const HANDOFF_REASON_LABEL: Record<HandoffReason, string> = {
  requested_human: "The customer asked to speak with a human.",
  ai_message_limit: `The assistant already sent ${MAX_AI_MESSAGES_PER_CONVERSATION} replies in this thread.`,
  ai_unavailable: "The AI assistant is unavailable.",
  out_of_credits: "The store is out of AI credits.",
  daily_cap: "The store hit its daily automatic-reply limit.",
}

/** True when the inbound text is asking for a human. */
export const detectHandoffKeyword = (text: string | null): boolean => {
  const t = (text ?? "").toLowerCase()
  if (!t.trim()) {
    return false
  }
  return HANDOFF_KEYWORDS.some((k) => t.includes(k))
}

/** What the bot decided to do with an inbound message. No side effects. */
export type AutoReplyDecision =
  | { action: "reply"; text: string }
  | { action: "handoff"; reason: HandoffReason }

/** Render the retrieved knowledge snippets as a prompt section. */
const knowledgeSection = (snippets: string[]): string => {
  if (!snippets.length) {
    return (
      "KNOWLEDGE: (no trained knowledge matched this question). Do not invent " +
      "policies, prices, or product details."
    )
  }
  return (
    "KNOWLEDGE (retrieved from the store's trained sources; the most relevant " +
    "first). Prefer these facts over your own assumptions:\n" +
    snippets.map((s, i) => `--- snippet ${i + 1} ---\n${s}`).join("\n")
  )
}

/** Render the bot's configured persona as a prompt section. */
const personaSection = (chatbot: any): string => {
  const lines: string[] = [
    `You are "${chatbot?.name ?? "the assistant"}", the brand's AI assistant ` +
      "answering a customer live in a chat thread. Reply with a single, concise " +
      "message (1-4 short sentences) addressed directly to the customer. No " +
      "subject line, no signature, no surrounding quotation marks.",
  ]
  const instructions = (chatbot?.instructions ?? "").toString().trim()
  if (instructions) {
    lines.push("OPERATOR INSTRUCTIONS (follow these exactly):\n" + instructions)
  }
  const language = (chatbot?.language ?? "").toString().trim()
  if (language) {
    lines.push(`Always reply in ${language}, whatever language the customer uses.`)
  }
  if (chatbot?.dont_go_beyond) {
    lines.push(
      "SCOPE LOCK: answer ONLY from the KNOWLEDGE and CUSTOMER FACTS below. If " +
        "the answer is not there, say you do not have that information and offer " +
        "to connect the customer with a human agent. Never improvise an answer " +
        "from general knowledge."
    )
  }
  lines.push(
    "If the customer asks for a human, is angry, or the request needs an " +
      "account/payment/refund action you cannot verify, say a human agent will " +
      "take over shortly."
  )
  return lines.join("\n\n")
}

/**
 * Decide the chatbot's response to an inbound message on a conversation.
 *
 * Handoff (no answer generated) when: the customer asked for a human, the bot
 * already sent `MAX_AI_MESSAGES_PER_CONVERSATION` replies in this thread, or no
 * AI provider is configured / generation came back empty. Otherwise: an answer
 * grounded in the SAME Customer360 + brand context `suggestReply` uses, plus the
 * bot's persona, the top-k retrieved knowledge, and the last `historyLimit`
 * non-internal messages as chat history.
 *
 * Pure decision — it writes nothing. Never throws (a failure decides handoff,
 * because a silent bot is worse than a queued thread).
 */
export const generateAutoReply = async (
  container: MedusaContainer,
  input: {
    conversationId: string
    tenantId: string
    chatbot: any
    inboundText: string | null
    historyLimit?: number
    topK?: number
  }
): Promise<AutoReplyDecision> => {
  try {
    if (detectHandoffKeyword(input.inboundText)) {
      return { action: "handoff", reason: "requested_human" }
    }

    const mk: any = container.resolve(MARKETING_MODULE)

    const [, aiMessageCount] = await mk
      .listAndCountMarketingMessages(
        {
          tenant_id: input.tenantId,
          conversation_id: input.conversationId,
          author: "ai",
        },
        { take: 1 }
      )
      .catch(() => [[], 0])
    if ((aiMessageCount ?? 0) >= MAX_AI_MESSAGES_PER_CONVERSATION) {
      return { action: "handoff", reason: "ai_message_limit" }
    }

    const grounding = await loadReplyGrounding(container, {
      conversationId: input.conversationId,
      tenantId: input.tenantId,
      historyLimit: input.historyLimit ?? 20,
      excludeSystem: true,
    })
    if (!grounding) {
      return { action: "handoff", reason: "ai_unavailable" }
    }

    const provider = getAiTextProvider()
    if (!provider) {
      return { action: "handoff", reason: "ai_unavailable" }
    }

    const snippets = await retrieveContext(
      container,
      input.tenantId,
      input.chatbot?.id,
      input.inboundText ?? "",
      input.topK ?? 4
    )

    const system = await buildReplySystem(container, input.tenantId, {
      persona: personaSection(input.chatbot),
      c360: grounding.c360,
      sections: [knowledgeSection(snippets)],
    })

    const prompt =
      "Conversation so far (oldest first):\n" +
      threadTranscript(grounding.history) +
      "\n\nThe customer's latest message:\n" +
      (input.inboundText ?? "(no text)") +
      "\n\nWrite the assistant's reply to the customer now."

    const raw = await provider.generate(prompt, { system, temperature: 0.3 })
    const text = (raw ?? "").toString().trim()
    if (!text) {
      return { action: "handoff", reason: "ai_unavailable" }
    }

    return { action: "reply", text }
  } catch {
    // No-throw: a failed generation queues the thread instead of dropping it.
    return { action: "handoff", reason: "ai_unavailable" }
  }
}
