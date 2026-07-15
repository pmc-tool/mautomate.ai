/**
 * chat-tools — the commerce toolset the CHAT agent (web widget, Messenger,
 * WhatsApp, Telegram, …) is allowed to call while answering a customer.
 *
 * It is the chat-side twin of the voice runtime's tool layer, but it REUSES that
 * layer rather than forking it:
 *   - the commerce backend is the call-center `CommerceGateway`
 *     (`getCommerceGateway`), which is sales-channel scoped per tenant and
 *     fail-closed;
 *   - the read tools themselves (`searchProducts`, `getProduct`, `getOrder`) are
 *     the EXACT handlers from `call-center/tools/registry`, invoked through a
 *     CHAT ToolContext (below). Their bodies are not copied.
 *
 * WHY A CHAT ToolContext: the voice `ToolContext` is CALL-anchored — it carries a
 * `callId` and the call-center service (`cc`), and its `resolveOrderId` falls back
 * to "the order linked to this call". A chat has no call. So we build a
 * CONVERSATION-anchored context: the same shape, with `callId` set to
 * `chat:<conversation_id>` (used only for log/audit strings) and `cc` set to a
 * guard object that THROWS if anything reaches for call state. Only the tools that
 * never touch `cc` are exposed, so that guard can never fire in production; it
 * exists so a future call-anchored tool cannot be silently mis-wired into chat.
 *
 * TOOLS EXPOSED TO CHAT (read-only + handoff — no writes, ever):
 *   searchProducts, getProduct   — reused verbatim from the call-center registry
 *   searchKnowledge              — this CHATBOT's RAG chunks (marketing/knowledge/rag)
 *   lookupOrder                  — VERIFIED order lookup (see GUARDRAILS)
 *   requestHuman                 — raises the handoff flag the runtime acts on
 *
 * The voice registry's write tools (cancelOrder, rescheduleDelivery,
 * updateShippingAddress, confirmOrder, flagOrder, addOrderNote, setDisposition)
 * and its call-only tools (transferToHuman, endCall) are DELIBERATELY NOT exposed:
 * a chat visitor is anonymous, so no mutation may be reachable from it.
 *
 * ============================ GUARDRAILS (lookupOrder) ======================
 * The web widget is ANONYMOUS. An unauthenticated visitor must never be able to
 * read — or even confirm the existence of — someone else's order.
 *
 * 1. VERIFICATION IS MANDATORY. A lookup only returns order details when ONE of:
 *      (a) order number + the email on the order (exact, case-insensitive), or
 *      (b) the order's private `support_code` (metadata.support_code — the same
 *          device the voice agent uses as its identity gate), or
 *      (c) the conversation's contact is already a MATCHED CUSTOMER
 *          (`contact.customer_id`, set by the channel, never by the visitor) and
 *          the order belongs to THAT customer id. Never cross-customer.
 * 2. NO ENUMERATION ORACLE. Every failure — order does not exist, wrong email,
 *    wrong code, another tenant's order — returns the SAME generic result. The
 *    tool never says whether the order number exists.
 * 3. RATE LIMITED. Failed verifications are counted per conversation
 *    (`lib/rate-limit`). After MAX_FAILED_VERIFICATIONS in the window the tool
 *    stops looking anything up and tells the model to offer a human. Successful
 *    lookups never consume the budget (that is why `peekRateLimit` exists).
 * 4. TENANT SCOPED, FAIL CLOSED. Every gateway call takes the tenant id of the
 *    CONVERSATION (resolved server-side, never from the model's arguments) and the
 *    Medusa adapter AND-s the tenant's sales channel into every query — a matching
 *    order number in another tenant's store simply does not exist here.
 * ===========================================================================
 *
 * NO-THROW: `execute` is the provider's tool executor and its contract is never to
 * throw — every failure becomes an `{ error }` result the model reads.
 */

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { consumeRateLimit, peekRateLimit } from "../../../lib/rate-limit"
import type { AiToolCall, AiToolDefinition } from "../ai/ai-provider"
import { getCommerceGateway } from "../../call-center/gateway"
import type {
  CommerceOrder,
  CommerceProduct,
  OrderProgress,
  OrderTracking,
} from "../../call-center/gateway"
import { getTool } from "../../call-center/tools/registry"
import type { ToolContext } from "../../call-center/tools/registry"
import { retrieveContext } from "../knowledge/rag"

/** Failed verification attempts one conversation gets before it is cut off. */
export const MAX_FAILED_VERIFICATIONS = 5

/** Window the failed-attempt budget is counted over. */
const VERIFICATION_WINDOW_SECONDS = 1800

/** Minimum digits a support code must have to even be worth a lookup. */
const MIN_SUPPORT_CODE_DIGITS = 4

/** Knowledge snippets a single searchKnowledge call may return. */
const KNOWLEDGE_TOP_K = 4

/**
 * The ONE answer every failed verification gets. Identical for "no such order",
 * "wrong email", "wrong code" and "another tenant's order" — so the tool cannot
 * be used to discover whether an order number exists.
 */
const GENERIC_VERIFICATION_FAILURE = {
  verified: false,
  message:
    "I could not verify that order. Please double-check the order number and the " +
    "email address used on the order, or share the support code from your order " +
    "confirmation.",
}

/** Returned once the conversation has burned its verification budget. */
const VERIFICATION_LOCKED = {
  verified: false,
  locked: true,
  message:
    "Too many failed verification attempts on this conversation. Do not attempt " +
    "another order lookup. Apologise and offer to connect the customer with a " +
    "human agent (call the requestHuman tool if they agree).",
}

/** Trimmed non-empty string, or undefined. */
const asString = (v: unknown): string | undefined => {
  if (typeof v === "string" && v.trim().length > 0) {
    return v.trim()
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(v)
  }
  return undefined
}

/** Normalize an email for an EXACT, case-insensitive comparison. */
const normEmail = (v: unknown): string | null => {
  const s = asString(v)
  return s ? s.toLowerCase() : null
}

/** Digits only (order numbers and support codes are numeric). */
const digits = (v: unknown): string | null => {
  const s = asString(v)
  if (!s) {
    return null
  }
  const d = s.replace(/\D/g, "")
  return d.length > 0 ? d : null
}

/**
 * A `cc` that must never be reached from chat. The chat toolset exposes only
 * tools that never touch call state; if that ever stops being true, this throws
 * loudly instead of silently reading/writing the wrong thing.
 */
const CHAT_NO_CALL_SERVICE: any = new Proxy(
  {},
  {
    get: () => {
      throw new Error(
        "[marketing-chat-tools] a call-anchored tool was invoked from a chat conversation"
      )
    },
  }
)

/** The chat agent's tool catalog, as JSON schemas for the model. */
export const CHAT_TOOL_DEFINITIONS: AiToolDefinition[] = [
  {
    name: "searchProducts",
    description:
      "Search this store's live product catalog by free text (e.g. 'blue running " +
      "shoes', 'candles'). Use it whenever the customer asks what you sell, what " +
      "you have, what is in stock, or what something costs. Returns real products " +
      "with price and stock. If the question is broad ('what do you sell?'), call " +
      "this with an EMPTY query string to list what the store actually carries — do " +
      "NOT ask the customer to narrow it down first, and never guess product names.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "what the customer is looking for; pass \"\" to list the catalog",
        },
        limit: {
          type: "number",
          description: "how many products to return (max 5)",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "getProduct",
    description:
      "Fetch ONE product from this store by its id, handle, or exact title — for " +
      "price, stock and description. Use after searchProducts when the customer " +
      "asks about a specific product.",
    parameters: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "the product id, if known" },
        handle: { type: "string", description: "the product handle, if known" },
        title: { type: "string", description: "the product title to match" },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "searchKnowledge",
    description:
      "Search the store's own trained knowledge base (policies, FAQ, shipping and " +
      "returns rules, opening hours, anything the merchant trained this assistant " +
      "on). Use it for any store-specific question that is not a live product or " +
      "order lookup. Never invent a policy — search first.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "the question to search the knowledge base for",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "lookupOrder",
    description:
      "Look up ONE order and its status. IF THE CUSTOMER IS SIGNED IN (the system " +
      "prompt says so), call this with NO arguments at all to get their most recent " +
      "order — they have already proven who they are, so NEVER ask a signed-in " +
      "customer for an order number, an email or a support code. " +
      "Otherwise the chat is anonymous and verification is MANDATORY: you must " +
      "supply EITHER the order number together with the email address used on the " +
      "order, OR the private support code from the order confirmation. ASK the " +
      "customer for those details first — never guess them, never call this with " +
      "only an order number, and never reveal any order detail that this tool did " +
      "not return. If it returns verified:false, the details were wrong: say you " +
      "could not verify the order and ask them to check; do not speculate about " +
      "whether the order exists.",
    parameters: {
      type: "object",
      properties: {
        order_number: {
          type: "string",
          description:
            "the order number the customer gave you (e.g. '1005' or '#1005')",
        },
        email: {
          type: "string",
          description: "the email address the customer says is on the order",
        },
        support_code: {
          type: "string",
          description:
            "the private numeric support code from the order confirmation, if the " +
            "customer has it (this alone verifies the order)",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "requestHuman",
    description:
      "Hand this conversation to a human agent. Call it when the customer asks for " +
      "a person, is upset, needs an account/payment/refund action you cannot " +
      "perform, or when you cannot verify an order after they have tried. After " +
      "calling it, do not keep answering — the human takes over.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "one short sentence on why a human is needed",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
]

/**
 * The rules the system prompt must carry alongside the tools. Kept next to the
 * tool definitions so the prompt and the toolset can never drift apart.
 */
export const CHAT_TOOL_GUIDE = [
  "TOOLS: you can call tools to look things up in this store. ALWAYS call a tool",
  "rather than guessing, and rather than asking the customer to narrow the question",
  "down first. searchProducts / getProduct for catalog, price and stock — for a broad",
  "question like 'what do you sell?' call searchProducts with an empty query and",
  "answer with the products it returns. searchKnowledge for store policies and",
  "anything the merchant trained you on. lookupOrder for order status. requestHuman",
  "to hand the conversation to a person.",
  "",
  "Tool results are FACTS you may use, including under a scope lock. Anything a tool",
  "did not return is NOT a fact: never fill a gap with a plausible guess.",
  "",
  "ORDER LOOKUPS ARE VERIFIED. This chat is anonymous, so you may NEVER reveal any",
  "order detail (status, items, total, address, dates) that a successful lookupOrder",
  "call did not return to you. Before calling lookupOrder you MUST have BOTH the",
  "order number AND the email address on the order, OR the private support code from",
  "the order confirmation. If the customer gives you only an order number, ASK for",
  "the email on the order or the support code — do not call the tool, and do not",
  "confirm or deny that the order number exists. If a lookup comes back",
  "verified:false, tell the customer you could not verify the order and ask them to",
  "check the details or offer a human; never say whether the order exists.",
].join("\n")

/**
 * A field the store never recorded. Rendered as an explicit string rather than
 * `null`, because a model reads `null` as "say something plausible" — and a
 * plausible guess about shipping is exactly the lie we must never tell.
 */
const UNKNOWN = "unknown - not recorded by the store"

/** The chat-safe projection of a VERIFIED order (no raw street address). */
const projectVerifiedOrder = (
  order: any,
  progress: OrderProgress | null,
  tracking: OrderTracking[]
) => {
  const shipping = order?.shipping_address ?? null
  return {
    verified: true,
    order_number: order?.display_id ?? null,
    // ONE status. The raw `status` / `payment_status` / `fulfillment_status`
    // flags are deliberately NOT here: they contradict each other, and a model
    // handed a contradiction will read it out.
    //
    // A missing status must degrade to "I don't know where it is" — NEVER to a
    // thrown error, which the customer would hear as "I can't verify your order"
    // about an order they just proved is theirs.
    status: progress?.headline ?? "Status unavailable",
    status_detail:
      progress?.detail ??
      "I do not have a current status for this order — offer to have someone check.",
    awaiting_payment: progress?.awaiting_payment ?? false,
    tracking: tracking.filter((t) => t.number),
    total: order?.total ?? null,
    currency_code: order?.currency_code ?? null,
    placed_at: order?.created_at ?? null,
    items: Array.isArray(order?.items)
      ? order.items.map((i: any) => ({
          title: i?.title ?? null,
          quantity: i?.quantity ?? null,
        }))
      : [],
    // Enough for the customer to recognise their delivery, without reading a full
    // street address back into an anonymous chat transcript.
    shipping_to: shipping
      ? {
          name: shipping.name ?? null,
          city: shipping.city ?? null,
          country_code: shipping.country_code ?? null,
        }
      : null,
    note:
      "These are the ONLY order facts you have. `status` and `status_detail` are " +
      "the WHOLE truth about where this order stands — they are already worked " +
      "out for the customer, so tell them that and nothing more. There are no " +
      "payment, fulfilment or internal status flags for you to report: do NOT " +
      "mention payment at all unless `awaiting_payment` is true (if the parcel " +
      "has shipped, the money is settled and raising it only frightens people). " +
      "If `tracking` is empty there is NO tracking number — say so plainly and " +
      "offer to have someone follow up; never invent one, and never invent a " +
      "delivery date.",
  }
}

/**
 * A product the model actually looked at while answering, in the shape a chat
 * bubble can render: image, price, link.
 *
 * The model is given a lean projection (title/price/stock) because every field
 * costs tokens — but the SURFACE wants a picture and a link. Both come from the
 * same gateway call, so the card data is free: we keep the full product here and
 * hand the model the short version.
 */
export type ProductCard = {
  id: string
  title: string | null
  handle: string | null
  thumbnail: string | null
  /** Cheapest variant price, in MAJOR units (1000 == $1,000). */
  price: number | null
  currency_code: string | null
  in_stock: boolean
}

/** At most this many cards ride along on one reply — a chat bubble, not a PLP. */
const MAX_PRODUCT_CARDS = 4

/**
 * A verified order, as a status card. Only ever built AFTER the identity gate in
 * `lookupOrder` has passed, so it carries nothing an anonymous visitor has not
 * already proven they are entitled to see.
 */
export type OrderCard = {
  type: "order"
  order_number: number | null
  placed_at: string | null
  stage: OrderProgress["stage"]
  headline: string
  detail: string
  total: number | null
  currency_code: string | null
  tracking: OrderTracking[]
  items: { title: string | null; quantity: number | null }[]
}

export type ChatToolRuntime = {
  /** The tool catalog handed to the model. */
  definitions: AiToolDefinition[]
  /** Execute one tool call. Never throws (provider contract). */
  execute: (call: AiToolCall) => Promise<unknown>
  /** True once the model called `requestHuman`. */
  handoffRequested: () => boolean
  /** The reason the model gave for the handoff, if any. */
  handoffReason: () => string | null
  /** Names of the tools actually executed, in order (for logs and tests). */
  used: () => string[]
  /** Products the model surfaced, for rendering as cards under its reply. */
  products: () => ProductCard[]
  /** The verified order the model looked up, if any, as a status card. */
  order: () => OrderCard | null
}

/**
 * Build the chat tool runtime for ONE conversation turn.
 *
 * `tenantId`, `conversationId`, `chatbotId` and `customerId` are all resolved
 * SERVER-SIDE from the conversation row before this is called — nothing here is
 * ever taken from the model's arguments, so a prompt-injected "tenant_id" or
 * "customer_id" has nowhere to land.
 */
export const createChatToolRuntime = (
  container: MedusaContainer,
  input: {
    tenantId: string
    conversationId: string
    chatbotId: string | null
    /** The customer this conversation is already matched to, or null. */
    customerId: string | null
    /**
     * What the customer actually just said. The budget lives HERE, not in the
     * tool arguments — the model is free to search for "sample product" while
     * the customer asked for something "under $50", and a card must honour the
     * customer's constraint, not the model's paraphrase of it.
     */
    inboundText?: string | null
  }
): ChatToolRuntime => {
  const gateway = getCommerceGateway(container)

  // The CHAT ToolContext: same shape the voice tools expect, conversation-anchored.
  const ctx: ToolContext = {
    container,
    tenantId: input.tenantId,
    callId: `chat:${input.conversationId}`,
    gateway,
    cc: CHAT_NO_CALL_SERVICE,
  }

  const failureKey = `mchat:orderverify:${input.tenantId}:${input.conversationId}`
  const usedTools: string[] = []
  let handoff = false
  let handoffReason: string | null = null

  // Every product the model looked at this turn, in first-seen order, deduped.
  const productCards: ProductCard[] = []
  // The one order it verified this turn, if it verified one.
  let orderCard: OrderCard | null = null

  const rememberProducts = (found: CommerceProduct[]): void => {
    for (const p of found) {
      if (!p?.id || productCards.length >= MAX_PRODUCT_CARDS) {
        continue
      }
      if (productCards.some((c) => c.id === p.id)) {
        continue
      }
      productCards.push({
        id: p.id,
        title: p.title ?? null,
        handle: p.handle ?? null,
        thumbnail: p.thumbnail ?? null,
        price: p.min_price ?? null,
        currency_code: p.currency_code ?? null,
        in_stock: (p.variants ?? []).some((v) => v.in_stock),
      })
    }
  }

  /**
   * The price range the customer asked for, if they asked for one. Mirrors the
   * gateway's own parsing (medusa-adapter.searchProducts).
   */
  const priceBounds = (query: string): { min: number | null; max: number | null } => {
    const q = (query ?? "").toLowerCase()
    const max = q.match(
      /(?:under|below|less than|cheaper than|max)\s*\$?\s*(\d+(?:\.\d+)?)/
    )
    const min = q.match(
      /(?:over|above|more than|at least|from)\s*\$?\s*(\d+(?:\.\d+)?)/
    )
    return {
      max: max ? Number(max[1]) : null,
      min: min ? Number(min[1]) : null,
    }
  }

  /**
   * Which of the found products may be shown as a CARD.
   *
   * The gateway deliberately falls back to returning out-of-range products when
   * a price filter matches nothing — otherwise the model would tell a customer
   * the store sells nothing, which is false. That fallback is right for the
   * model's CONTEXT ("our catalogue starts higher than that") and wrong for a
   * card: a card is a recommendation, and a $1,000 card under the words "nothing
   * under $50" makes the assistant look broken. So the cards — and only the
   * cards — hold to the constraint the customer actually stated.
   */
  const cardable = (found: CommerceProduct[], query: string): CommerceProduct[] => {
    // Read the budget from what the CUSTOMER said, falling back to the model's
    // own query — whichever states a limit, the cards respect it.
    const { min, max } = priceBounds(
      `${input.inboundText ?? ""} ${query ?? ""}`
    )
    if (min == null && max == null) {
      return found
    }
    return found.filter((p) => {
      if (p.min_price == null) {
        return false
      }
      if (max != null && p.min_price > max) {
        return false
      }
      if (min != null && p.min_price < min) {
        return false
      }
      return true
    })
  }

  /** What the MODEL sees: enough to talk about, nothing it has to pay for twice. */
  const forModel = (found: CommerceProduct[]): unknown => {
    if (!found.length) {
      return { products: [], note: "no matching products in this store" }
    }
    return {
      products: found.map((p) => ({
        title: p.title,
        handle: p.handle,
        min_price: p.min_price,
        currency_code: p.currency_code,
        in_stock: (p.variants ?? []).some((v) => v.in_stock),
      })),
    }
  }

  /** Delegate to a call-center registry tool, unchanged. */
  const runRegistryTool = async (
    name: string,
    args: Record<string, unknown>
  ): Promise<unknown> => {
    const tool = getTool(name)
    if (!tool) {
      return { error: `unknown tool ${name}` }
    }
    // Defense in depth: chat may only ever run READ tools from the registry.
    if (tool.write) {
      return { error: `tool ${name} is not available in chat` }
    }
    const res = await tool.handler(ctx, args)
    return res.error ? { error: res.error } : (res.result ?? null)
  }

  /**
   * Resolve the ONE order the customer has proven they own, or null.
   * Every path is tenant-scoped by the gateway (sales channel, fail closed).
   */
  const verifyOrder = async (args: {
    orderNumber: string | null
    email: string | null
    code: string | null
  }): Promise<CommerceOrder | null> => {
    // (b) SUPPORT CODE — the private code on the order confirmation. Sufficient
    // on its own (this is exactly the voice agent's identity gate).
    if (args.code && args.code.length >= MIN_SUPPORT_CODE_DIGITS) {
      const byCode = await gateway.findOrders(input.tenantId, {
        code: args.code,
      })
      const matches = byCode.filter(
        (o) => String((o.metadata as any)?.support_code ?? "") === args.code
      )
      // If they also named an order number, it has to be the same order.
      const narrowed = args.orderNumber
        ? matches.filter((o) => String(o.display_id ?? "") === args.orderNumber)
        : matches
      if (narrowed.length === 1) {
        return narrowed[0]
      }
      return null
    }

    if (!args.orderNumber) {
      return null
    }

    const byNumber = await gateway.findOrders(input.tenantId, {
      display_id: args.orderNumber,
    })
    const candidates = byNumber.filter(
      (o) => String(o.display_id ?? "") === args.orderNumber
    )
    if (candidates.length !== 1) {
      return null
    }
    const order = candidates[0]

    // (c) OWN ORDER — the conversation is already bound to a known customer (the
    // channel matched them; the visitor cannot assert this). Only that customer's
    // own orders, never anyone else's.
    if (input.customerId && order.customer_id === input.customerId) {
      return order
    }

    // (a) ORDER NUMBER + EMAIL — exact, case-insensitive match on the order's email.
    if (args.email) {
      const onOrder = normEmail(order.email)
      if (onOrder && onOrder === args.email) {
        return order
      }
    }

    return null
  }

  const lookupOrder = async (
    args: Record<string, unknown>
  ): Promise<unknown> => {
    // (3) Budget check FIRST — a locked conversation performs no lookup at all.
    const budget = await peekRateLimit(
      failureKey,
      MAX_FAILED_VERIFICATIONS,
      VERIFICATION_WINDOW_SECONDS
    ).catch(() => null)
    if (budget && !budget.allowed) {
      return VERIFICATION_LOCKED
    }

    const orderNumber = digits(args.order_number ?? args.display_id)
    const email = normEmail(args.email)
    const code = digits(args.support_code ?? args.order_code ?? args.code)

    // (0) SIGNED IN. The storefront already authenticated this shopper, so there
    // is nothing left for them to prove — demanding an order number and the email
    // on the order from someone the store is literally logged in as is the hassle
    // this whole path exists to remove. With no order number we simply hand back
    // their most recent order; that IS the answer to "where is my order?".
    if (input.customerId && !orderNumber && !code) {
      const own = await gateway
        .listCustomerOrders(input.tenantId, { customer_id: input.customerId })
        .catch(() => [] as CommerceOrder[])
      if (!own.length) {
        return {
          verified: true,
          signed_in: true,
          orders: [],
          note:
            "This customer is signed in and has no orders in this store yet. Say " +
            "so warmly and offer to help them find something.",
        }
      }
      const latest = [...own].sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime()
      )[0]
      return await presentOrder(latest, own.length)
    }

    // (1) No credential at all -> do not touch the database. Nothing to leak, and
    // the model is told exactly what to ask for. This does NOT burn the budget:
    // it is a prompt mistake, not a failed verification attempt.
    const hasOwnOrderClaim = Boolean(input.customerId && orderNumber)
    if (!code && !hasOwnOrderClaim && !(orderNumber && email)) {
      return {
        verified: false,
        need_verification: true,
        message:
          "Before I can look up an order I need the order number AND the email " +
          "address used on the order, or the support code from the order " +
          "confirmation. Ask the customer for them.",
      }
    }

    const order = await verifyOrder({ orderNumber, email, code }).catch(
      () => null
    )

    if (!order) {
      // (2) Failed verification: burn one unit of the budget and return the SAME
      // generic answer for every cause (missing / wrong email / wrong code /
      // other tenant). No enumeration oracle.
      const spent = await consumeRateLimit(
        failureKey,
        MAX_FAILED_VERIFICATIONS,
        VERIFICATION_WINDOW_SECONDS
      ).catch(() => null)
      if (spent && !spent.allowed) {
        return VERIFICATION_LOCKED
      }
      return GENERIC_VERIFICATION_FAILURE
    }

    // VERIFIED. Fetch the full order through the call-center registry's own
    // getOrder tool (same handler the voice agent uses, tenant-scoped), then
    // project it to the chat-safe shape.
    return await presentOrder(order, null)
  }

  /** Load an order in full, remember it as a card, and project it for the model. */
  const presentOrder = async (
    order: CommerceOrder,
    totalOwnOrders: number | null
  ): Promise<unknown> => {
    const full: any = await runRegistryTool("getOrder", { order_id: order.id })
    if (!full || full.error) {
      return GENERIC_VERIFICATION_FAILURE
    }

    // The gateway now returns the order already reconciled: true totals and
    // quantities from the order's latest version, the shipment facts, and ONE
    // derived status. No second opinion is needed here.
    const tracking = (full.tracking ?? []).filter((t: any) => t.number)
    const progress = full.progress ?? null

    orderCard = progress
      ? {
          type: "order",
          order_number: full.display_id ?? null,
          placed_at: full.created_at ?? null,
          stage: progress.stage,
          headline: progress.headline,
          detail: progress.detail,
          total: full.total ?? null,
          currency_code: full.currency_code ?? null,
          tracking,
          items: Array.isArray(full.items)
            ? full.items.slice(0, 4).map((i: any) => ({
                title: i?.title ?? null,
                quantity: i?.quantity ?? null,
              }))
            : [],
        }
      : null

    const projected: any = projectVerifiedOrder(full, progress, tracking)
    if (totalOwnOrders && totalOwnOrders > 1) {
      projected.other_orders = totalOwnOrders - 1
      projected.note +=
        ` This is their MOST RECENT order; they have ${totalOwnOrders - 1} other ` +
        "order(s) in this store. Offer to look at those if they mean a different one."
    }
    return projected
  }

  const searchKnowledge = async (
    args: Record<string, unknown>
  ): Promise<unknown> => {
    const query = asString(args.query) ?? asString(args.q)
    if (!query) {
      return { error: "query is required" }
    }
    if (!input.chatbotId) {
      return { snippets: [], note: "this assistant has no knowledge base" }
    }
    // SCOPED to {this tenant, THIS chatbot} by retrieveContext itself.
    const snippets = await retrieveContext(
      container,
      input.tenantId,
      input.chatbotId,
      query,
      KNOWLEDGE_TOP_K
    ).catch(() => [] as string[])
    if (!snippets.length) {
      return {
        snippets: [],
        note:
          "nothing in the store's knowledge base matched. Do not invent a policy — " +
          "say you do not have that information and offer a human agent.",
      }
    }
    return { snippets }
  }

  const requestHuman = async (
    args: Record<string, unknown>
  ): Promise<unknown> => {
    handoff = true
    handoffReason = asString(args.reason) ?? null
    return {
      queued: true,
      note:
        "A human agent has been queued for this conversation. Tell the customer " +
        "someone from the team will reply here shortly, and stop.",
    }
  }

  const execute = async (call: AiToolCall): Promise<unknown> => {
    const name = call?.name ?? ""
    const args = call?.arguments ?? {}
    usedTools.push(name)
    // Observability: WHICH tool ran on WHICH conversation. No arguments and no
    // results are logged — they carry customer PII.
    // eslint-disable-next-line no-console
    console.log(
      `[marketing-chat-tools] conversation=${input.conversationId} tool=${name}`
    )
    try {
      switch (name) {
        // Both product tools now go straight to the gateway rather than through
        // the registry's projection. Same tenant-scoped, fail-closed call one
        // line deeper — but we keep the FULL product, so the reply can carry
        // real cards (image, price, link) instead of the model's prose about
        // them. The model still only sees the lean projection.
        case "searchProducts": {
          const rawLimit = Number((args as any).limit)
          const limit =
            Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 5) : 5
          const query =
            asString((args as any).query) ?? asString((args as any).q) ?? ""
          const found = await gateway.searchProducts(input.tenantId, query, limit)
          // The model sees everything the gateway returned; only products that
          // actually meet the customer's stated budget become cards.
          rememberProducts(cardable(found, query))
          return forModel(found)
        }
        case "getProduct": {
          const key =
            asString((args as any).product_id) ?? asString((args as any).handle)
          let found = key
            ? await gateway.getProduct(input.tenantId, key)
            : null
          // The model may only know the title. Fall back to a search rather than
          // telling a customer we do not carry a product we plainly do.
          if (!found) {
            const term =
              asString((args as any).title) ??
              asString((args as any).handle) ??
              asString((args as any).product_id)
            if (term) {
              found = (await gateway.searchProducts(input.tenantId, term, 1))[0] ?? null
            }
          }
          if (!found) {
            return { error: "no such product in this store" }
          }
          rememberProducts([found])
          return forModel([found])
        }
        case "searchKnowledge":
          return await searchKnowledge(args)
        case "lookupOrder":
          return await lookupOrder(args)
        case "requestHuman":
          return await requestHuman(args)
        default:
          return { error: `unknown tool ${name}` }
      }
    } catch (e: any) {
      // NO-THROW contract: a broken tool must degrade the answer, not the run.
      // eslint-disable-next-line no-console
      console.error(
        `[marketing-chat-tools] ${name} failed on conversation ${input.conversationId}: ${
          e?.message ?? e
        }`
      )
      return { error: "that lookup failed. Do not guess — offer to check and follow up." }
    }
  }

  return {
    definitions: CHAT_TOOL_DEFINITIONS,
    execute,
    handoffRequested: () => handoff,
    handoffReason: () => handoffReason,
    used: () => [...usedTools],
    products: () => [...productCards],
    order: () => orderCard,
  }
}
