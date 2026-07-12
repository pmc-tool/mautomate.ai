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
// The call-center gateway is the sales-channel-scoped commerce reader the tools
// use; it also exposes `listCustomerOrders(email)`, which the marketing gateway
// does not. Cross-module reuse (not a fork) — the same precedent as knowledge/rag.
import { getCommerceGateway as getScopedCommerceGateway } from "../../call-center/gateway"
import { getAiTextProvider } from "../ai/registry"
import { buildBrandContext } from "../content/brand-context"
import { retrieveContext } from "../knowledge/rag"
import { CHAT_TOOL_GUIDE, createChatToolRuntime } from "./chat-tools"

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
 * Channels on which the contact's email is SELF-ASSERTED by an anonymous visitor
 * rather than supplied by the platform. An email from one of these can never be
 * used to match a customer — otherwise a visitor could type someone else's
 * address and be handed their order history. (The web widget does not collect an
 * email today; this gate keeps the branch safe if that ever changes.)
 */
const UNTRUSTED_EMAIL_CHANNELS = new Set(["web_widget"])

/**
 * Resolve the Customer360 for a contact. Prefers a linked `customer_id`; falls
 * back to a phone match, then to a CHANNEL-SUPPLIED email match; otherwise
 * returns an unmatched snapshot. Never throws — any gateway failure yields
 * `matched:false`.
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

    const trustedEmail =
      typeof contact.email === "string" &&
      contact.email.trim().length > 0 &&
      !UNTRUSTED_EMAIL_CHANNELS.has(contact.primary_channel)
        ? contact.email.trim().toLowerCase()
        : null

    if (contact.customer_id) {
      customer = await gateway.getCustomer(currentTenantId(), contact.customer_id)
      const all = await gateway.queryOrders(currentTenantId(), { limit: 200 })
      orders = all.filter((o) => o.customer_id === contact.customer_id)
    } else if (trustedEmail) {
      // EMAIL BRANCH. Scoped by the call-center gateway to the tenant's sales
      // channel (fail closed), then filtered to an EXACT case-insensitive match —
      // the adapter's own email path is fuzzy (built for garbled speech), which
      // is not acceptable as an identity match here.
      const scoped = getScopedCommerceGateway(container)
      const found = await scoped
        .listCustomerOrders(currentTenantId(), { email: trustedEmail })
        .catch(() => [])
      const mine = (found ?? []).filter(
        (o: any) =>
          typeof o.email === "string" &&
          o.email.trim().toLowerCase() === trustedEmail
      )
      const customerId = mine.find((o: any) => o.customer_id)?.customer_id
      if (customerId) {
        customer = await gateway
          .getCustomer(currentTenantId(), customerId)
          .catch(() => null)
      }
      if (!customer && mine.length) {
        // Guest checkout: no customer account, but these orders ARE this contact's.
        customer = {
          id: `guest:${trustedEmail}`,
          email: trustedEmail,
          phone: (mine[0] as any).phone ?? null,
          first_name: (mine[0] as any).shipping_address?.name ?? null,
          last_name: null,
          has_account: false,
          addresses: [],
        } as CommerceCustomer
      }
      orders = mine as unknown as CommerceOrder[]
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
  "delivery dates, shipping status, refunds, or stock. Only reference order, " +
  "product or customer details that appear in the CUSTOMER FACTS, in the " +
  "conversation below, or in a result one of your TOOLS returned in this turn. " +
  "If the customer asks for a detail you do not have, say you will check and " +
  "follow up rather than fabricating it."

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

/**
 * What the bot decided to do with an inbound message. No side effects.
 *
 * `units` is the number of MODEL COMPLETIONS the decision actually consumed —
 * 0 when no model ran (keyword handoff, reply limit, no provider), 1 for a plain
 * answer, and N for a tool-assisted answer that took N rounds. The runtime meters
 * exactly this (see `auto-reply`), so a tool-using reply is billed honestly rather
 * than being charged as one unit or silently multiplying the bill.
 */
export type AutoReplyDecision =
  | { action: "reply"; text: string; units: number; tools?: string[] }
  | { action: "handoff"; reason: HandoffReason; units: number }

/**
 * Hard cap on model completions in one tool-assisted reply. The runtime RESERVES
 * this many credits before the call and commits only what was used.
 */
export const MAX_AI_ROUNDS_PER_REPLY = 4

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
      "SCOPE LOCK: answer ONLY from the KNOWLEDGE, the CUSTOMER FACTS, and the " +
        "results your TOOLS return. If the answer is not in any of those, say you " +
        "do not have that information and offer to connect the customer with a " +
        "human agent. Never improvise an answer from general knowledge."
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
      return { action: "handoff", reason: "requested_human", units: 0 }
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
      return { action: "handoff", reason: "ai_message_limit", units: 0 }
    }

    const grounding = await loadReplyGrounding(container, {
      conversationId: input.conversationId,
      tenantId: input.tenantId,
      historyLimit: input.historyLimit ?? 20,
      excludeSystem: true,
    })
    if (!grounding) {
      return { action: "handoff", reason: "ai_unavailable", units: 0 }
    }

    const provider = getAiTextProvider()
    if (!provider) {
      return { action: "handoff", reason: "ai_unavailable", units: 0 }
    }

    // Pre-retrieved knowledge stays exactly as before (the bot's own chunks for
    // THIS question). The tool path adds `searchKnowledge` on top, so the model
    // can also go looking for something the first retrieval missed.
    const snippets = await retrieveContext(
      container,
      input.tenantId,
      input.chatbot?.id,
      input.inboundText ?? "",
      input.topK ?? 4
    )

    const toolsEnabled =
      provider.supportsTools === true && typeof provider.runTools === "function"

    const system = await buildReplySystem(container, input.tenantId, {
      persona: personaSection(input.chatbot),
      c360: grounding.c360,
      sections: [
        knowledgeSection(snippets),
        ...(toolsEnabled ? [CHAT_TOOL_GUIDE] : []),
      ],
    })

    const prompt =
      "Conversation so far (oldest first):\n" +
      threadTranscript(grounding.history) +
      "\n\nThe customer's latest message:\n" +
      (input.inboundText ?? "(no text)") +
      "\n\nWrite the assistant's reply to the customer now."

    // --- No tool support (non-OpenAI provider): the original single-shot path.
    if (!toolsEnabled) {
      const raw = await provider.generate(prompt, { system, temperature: 0.3 })
      const text = (raw ?? "").toString().trim()
      if (!text) {
        return { action: "handoff", reason: "ai_unavailable", units: 0 }
      }
      return { action: "reply", text, units: 1 }
    }

    // --- Tool-enabled path. The runtime is anchored to THIS conversation, THIS
    // tenant and THIS chatbot; the matched customer id (if any) comes from the
    // contact row, never from the model.
    const contact = grounding.conversation?.contact_id
      ? await mk
          .retrieveMarketingContact(grounding.conversation.contact_id)
          .catch(() => null)
      : null

    const runtime = createChatToolRuntime(container, {
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      chatbotId: input.chatbot?.id ?? null,
      customerId: contact?.customer_id ?? null,
    })

    const run = await provider.runTools!(prompt, {
      system,
      temperature: 0.3,
      tools: runtime.definitions,
      execute: runtime.execute,
      maxRounds: MAX_AI_ROUNDS_PER_REPLY,
    })

    const units = Math.max(1, run.rounds)

    // The model asked for a human -> the RUNTIME owns the handoff (queue + system
    // message + holding message). We only report the decision, so there is exactly
    // one handoff implementation (auto-reply's).
    if (runtime.handoffRequested()) {
      return { action: "handoff", reason: "requested_human", units }
    }

    const text = (run.text ?? "").toString().trim()
    if (!text) {
      return { action: "handoff", reason: "ai_unavailable", units }
    }

    return { action: "reply", text, units, tools: runtime.used() }
  } catch {
    // No-throw: a failed generation queues the thread instead of dropping it.
    return { action: "handoff", reason: "ai_unavailable", units: 0 }
  }
}

/** One turn of the in-dashboard test conversation. */
export type TestReplyTurn = { role: "user" | "assistant"; text: string }

export type TestReplyResult = {
  reply: string
  /** How many trained knowledge snippets actually grounded this answer. */
  used_knowledge: number
  /** True when no AI provider is configured — the UI should say so, not retry. */
  needs_ai: boolean
  /** Tools the model called while answering (empty when it needed none). */
  used_tools?: string[]
}

/** What the test chat says when the bot decides a human should take over. */
const TEST_HANDOFF_REPLY =
  "A human agent would take over this conversation from here."

/**
 * Answer ONE question as a chatbot would, with NO side effects — no conversation
 * row, no message rows, no metering of a customer thread. This powers the "Test"
 * step of the chatbot studio, so it deliberately reuses the SAME prompt the live
 * pipeline uses: `personaSection` (instructions / scope lock / language),
 * `buildReplySystem` (brand voice + Customer360 + grounding rule) and
 * `knowledgeSection` over `retrieveContext` (the bot's trained chunks).
 *
 * The one honest difference from `generateAutoReply`: there is no real customer
 * behind a test chat, so the Customer360 is the unmatched snapshot. Everything a
 * merchant is testing — persona, scope lock, language, trained knowledge — is
 * identical to what a visitor gets.
 *
 * Never throws: a missing provider returns `needs_ai:true` with an empty reply.
 */
export const generateTestReply = async (
  container: MedusaContainer,
  input: {
    tenantId: string
    chatbot: any
    message: string
    history?: TestReplyTurn[]
    topK?: number
  }
): Promise<TestReplyResult> => {
  const provider = getAiTextProvider()
  if (!provider) {
    return { reply: "", used_knowledge: 0, needs_ai: true }
  }

  const question = (input.message ?? "").toString().trim()
  if (!question) {
    return { reply: "", used_knowledge: 0, needs_ai: false }
  }

  const snippets = await retrieveContext(
    container,
    input.tenantId,
    input.chatbot?.id,
    question,
    input.topK ?? 4
  ).catch(() => [] as string[])

  const c360 = await buildCustomer360(container, null).catch(
    () => ({ matched: false }) as Customer360
  )

  const toolsEnabled =
    provider.supportsTools === true && typeof provider.runTools === "function"

  const system = await buildReplySystem(container, input.tenantId, {
    persona: personaSection(input.chatbot),
    c360,
    sections: [
      knowledgeSection(snippets),
      ...(toolsEnabled ? [CHAT_TOOL_GUIDE] : []),
    ],
  })

  const turns = (input.history ?? [])
    .filter((t) => t && typeof t.text === "string" && t.text.trim().length > 0)
    .slice(-10)
    .map((t) => `${t.role === "user" ? "Customer" : "Assistant"}: ${t.text.trim()}`)

  const prompt =
    (turns.length
      ? "Conversation so far (oldest first):\n" + turns.join("\n") + "\n\n"
      : "") +
    "The customer's latest message:\n" +
    question +
    "\n\nWrite the assistant's reply to the customer now."

  if (!toolsEnabled) {
    const raw = await provider
      .generate(prompt, { system, temperature: 0.3 })
      .catch(() => "")
    return {
      reply: (raw ?? "").toString().trim(),
      used_knowledge: snippets.length,
      needs_ai: false,
    }
  }

  // The SAME tool path a real visitor gets, so a merchant can test it. There is no
  // real customer and no conversation row behind a test chat: the runtime is
  // anchored to an ephemeral id (which is all the rate-limit key needs) and
  // `customerId` is null, so a verified order lookup can only succeed with a real
  // order number + email, or a real support code. Anything else fails verification
  // exactly as it would for a visitor — which is the correct behaviour to test.
  const runtime = createChatToolRuntime(container, {
    tenantId: input.tenantId,
    conversationId: `test:${input.chatbot?.id ?? "unknown"}`,
    chatbotId: input.chatbot?.id ?? null,
    customerId: null,
  })

  const run = await provider
    .runTools!(prompt, {
      system,
      temperature: 0.3,
      tools: runtime.definitions,
      execute: runtime.execute,
      maxRounds: MAX_AI_ROUNDS_PER_REPLY,
    })
    .catch(() => null)

  const answered = (run?.text ?? "").toString().trim()
  const reply =
    answered || (runtime.handoffRequested() ? TEST_HANDOFF_REPLY : "")

  return {
    reply,
    used_knowledge: snippets.length,
    needs_ai: false,
    used_tools: runtime.used(),
  }
}
