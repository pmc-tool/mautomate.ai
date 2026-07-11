import {
  getCurrentTenantId,
  resolveTenantId,
} from "../../../lib/tenant-context"
/**
 * ai-reply — the grounded reply engine behind the inbox.
 *
 * Two jobs, both no-throw so they can run on the live request path:
 *   1. `buildCustomer360` resolves a commerce snapshot for a contact (the
 *      matched customer + their order history) through the CommerceGateway, so
 *      an agent (or the AI) can see who they are talking to.
 *   2. `suggestReply` drafts an on-brand customer-service reply grounded in the
 *      recent thread + the Customer360 facts, with a hard rule never to invent
 *      order / shipping details not present in the grounding.
 *
 * NO-THROW: a gateway failure degrades Customer360 to `matched:false`; a missing
 * or failing AI provider degrades the suggestion to an empty string. Neither
 * ever throws — the inbox stays up even when commerce or AI is unavailable.
 */

import type { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from "../index"
import { getCommerceGateway } from "../gateway"
import type { CommerceCustomer, CommerceOrder } from "../gateway"
import { getAiTextProvider } from "../ai/registry"
import { buildBrandContext } from "../content/brand-context"

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
    const mk: any = container.resolve(MARKETING_MODULE)

    const conversation = await mk.retrieveMarketingConversation(
      input.conversationId
    )
    if (!conversation || conversation.tenant_id !== input.tenantId) {
      return { suggestion: "", needs_ai: true }
    }

    // Last ~15 messages, newest-first from the store, flipped to chronological.
    const recent = await mk.listMarketingMessages(
      { conversation_id: input.conversationId },
      { order: { sent_at: "DESC" }, take: 15 }
    )
    const chronological = [...(recent ?? [])].reverse()

    let contact: any = null
    if (conversation.contact_id) {
      try {
        contact = await mk.retrieveMarketingContact(conversation.contact_id)
      } catch {
        contact = null
      }
    }

    const c360 = await buildCustomer360(container, contact)

    const provider = getAiTextProvider()
    if (!provider) {
      return { suggestion: "", needs_ai: true }
    }

    const brand = await buildBrandContext(container, input.tenantId, {})
    const persona =
      "You are a helpful, warm customer-service agent replying on behalf of the " +
      "brand inside a messaging inbox. Write a single concise reply (1-3 short " +
      "sentences) in the brand's voice, addressed directly to the customer. Do " +
      "not include a subject line, signature, or quotation marks around the reply."
    const groundingRule =
      "HARD RULE: Never invent or guess order numbers, totals, tracking numbers, " +
      "delivery dates, shipping status, refunds, or stock. Only reference order or " +
      "customer details that appear in the CUSTOMER FACTS or the conversation " +
      "below. If the customer asks for a detail you do not have, say you will " +
      "check and follow up rather than fabricating it."

    const system = [
      brand,
      persona,
      "CUSTOMER FACTS:\n" + customer360Facts(c360),
      groundingRule,
    ].join("\n\n")

    const prompt =
      "Recent conversation (oldest first):\n" +
      threadTranscript(chronological) +
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
