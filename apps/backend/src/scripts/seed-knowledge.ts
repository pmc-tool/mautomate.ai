import { CALL_CENTER_MODULE } from "../modules/call-center"
import { ingestKnowledgeEntry } from "../modules/call-center/knowledge/rag"

const PLAYBOOK_ID = "playbook_01KX1TGPK59B571BDADCQAYPN2"
const TENANT_ID = "ten_01KX1C5HT67VS85MGEVT4A6HQB"
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"

const KB = [
  {
    name: "Shipping policy",
    source_type: "faq",
    content:
      "We ship Australia-wide only. Standard shipping takes 3 to 5 business days and costs 9 dollars 95, and is free on orders over 100 dollars. Express shipping takes 1 to 2 business days and costs 14 dollars 95. Orders placed before 2pm Sydney time on a business day are dispatched the same day. We do not currently ship internationally.",
  },
  {
    name: "Returns and refunds",
    source_type: "faq",
    content:
      "You can return any item within 30 days of delivery for a full refund, as long as it is unused and in its original packaging. Sale items are final and cannot be returned. To start a return, contact our support team and we will email you a prepaid return label. Once we receive the item, refunds are processed back to your original payment method within 5 business days.",
  },
  {
    name: "Store hours and payment",
    source_type: "faq",
    content:
      "Our online store is open 24 hours a day, 7 days a week. Customer support is available Monday to Friday, 9am to 5pm Sydney time. We accept Visa, Mastercard, American Express, and PayPal. Gift wrapping is available at checkout for 4 dollars 95. All prices on the site are in Australian dollars and include GST.",
  },
]

const TOOLS = [
  {
    name: "findOrders",
    description:
      "Look up the caller's order(s) by the order number they read out, or by the email or phone on the order.",
    parameters: {
      type: "object",
      properties: {
        order_number: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
      },
    },
  },
  {
    name: "listCustomerOrders",
    description:
      "List recent orders for a customer by their email or phone when they don't have the order number.",
    parameters: {
      type: "object",
      properties: { email: { type: "string" }, phone: { type: "string" } },
    },
  },
  {
    name: "searchProducts",
    description:
      "Search this store's products by keywords for availability, price and stock questions.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer" },
      },
      required: ["query"],
    },
  },
  {
    name: "getProduct",
    description:
      "Get full details (variants, price, stock) for one product by handle, id, or exact title.",
    parameters: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        handle: { type: "string" },
        title: { type: "string" },
      },
    },
  },
  {
    name: "searchKnowledge",
    description:
      "Search this store's own knowledge base (shipping, returns, store hours, payment and other policies) to answer store-specific questions. Use this whenever the caller asks about a policy or anything not answered by a product or order lookup.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "transferToHuman",
    description:
      "Hand the call to a human agent when the caller asks for a person or you cannot help.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "endCall",
    description: "End the call politely once the caller is done.",
    parameters: { type: "object", properties: {} },
  },
]

const toolNames = TOOLS.map((t) => t.name)

const systemPrompt = [
  "You are Ava, a friendly and capable voice assistant for an online store.",
  "You are speaking OUT LOUD on a live voice call, so keep every reply short, warm and natural - usually one or two sentences. Never read out lists, URLs, markdown or code. Say prices and numbers the way a person naturally would.",
  "YOU CAN LOOK THINGS UP. Use searchProducts or getProduct for product questions (availability, price, stock). Use findOrders or listCustomerOrders for order questions. Use searchKnowledge for store POLICY questions - shipping, returns, refunds, store hours, payment. Answer only from what a tool returns; never guess a product, price, stock level, order, or policy.",
  "IDENTITY: before reading out personal order details (address, items, totals), confirm at least one identifier the caller gave (order number plus email or phone) matches the order you found. If it doesn't match, do not read the details - offer to take a message or transfer to a human.",
  "HONESTY: if a tool returns nothing, say so plainly and offer to try another detail, take a message, or connect a human. Never invent facts.",
  "PLACING ORDERS: you cannot take payment or place an order on this call. You CAN help the caller find the right product, tell them the price and whether it's in stock, explain the store's policies, and explain how to order on the website - then offer to transfer to a human.",
  "One question at a time: listen, acknowledge, then respond. End the call politely with endCall when the caller is done.",
].join(" ")

const definition = {
  persona: {
    name: "Ava",
    voice_provider: "elevenlabs",
    voice_id: VOICE_ID,
    language: "en",
    tone: "warm, upbeat, professional",
    style: "concise and natural for spoken conversation",
  },
  objective:
    "Be a helpful voice concierge: answer product questions from live catalog lookups, look up orders, and answer store-policy questions from the knowledge base - honestly, never inventing facts.",
  first_message:
    "Hi! Thanks for calling. This is Ava, your store assistant. How can I help you today?",
  system_prompt: systemPrompt,
  tools: TOOLS,
  states: [
    {
      id: "main",
      goal: "Help the caller with products, orders and store policies using the lookup tools; verify identity before sharing order details.",
      allowed_tools: toolNames,
    },
  ],
  guardrails: {
    max_turns: 60,
    max_clarify: 2,
    save_offer_once: true,
    recording_disclosure:
      "Just so you know, this call may be recorded to help us improve our service.",
  },
  disposition_set: [
    "answered_product_question",
    "answered_policy_question",
    "looked_up_order",
    "took_message",
    "transferred_to_human",
    "caller_ended",
  ],
  dtmf_map: {},
}

export default async function seedKnowledge({ container }: any) {
  const cc: any = container.resolve(CALL_CENTER_MODULE)

  // 1. Seed KB entries (idempotent by name) + ingest (embed) each.
  const existing = await cc
    .listKnowledgeEntries(
      { tenant_id: TENANT_ID, agent_id: PLAYBOOK_ID },
      { take: 100 }
    )
    .catch(() => [])
  const haveNames = new Set((existing || []).map((e: any) => e.name))

  let created = 0
  let chunks = 0
  for (const entry of KB) {
    let row = (existing || []).find((e: any) => e.name === entry.name)
    if (!row) {
      row = await cc.createKnowledgeEntries({
        tenant_id: TENANT_ID,
        agent_id: PLAYBOOK_ID,
        name: entry.name,
        source_type: entry.source_type,
        content: entry.content,
      })
      created++
    }
    const n = await ingestKnowledgeEntry(cc, row).catch((e: any) => {
      console.error("[seed-knowledge] ingest failed:", entry.name, e?.message)
      return 0
    })
    chunks += n
    console.log(`[seed-knowledge] ${entry.name}: ${n} chunk(s)`)
  }

  // 2. Publish a new Ava version (v3) that includes searchKnowledge.
  const versions = await cc
    .listPlaybookVersions(
      { playbook_id: PLAYBOOK_ID, tenant_id: TENANT_ID },
      { take: 1, order: { version: "DESC" } }
    )
    .catch(() => [])
  const nextVersion =
    (Array.isArray(versions) && versions.length ? versions[0].version : 1) + 1

  const version = await cc.createPlaybookVersions({
    tenant_id: TENANT_ID,
    playbook_id: PLAYBOOK_ID,
    version: nextVersion,
    definition,
    published: true,
  })
  await cc.updatePlaybooks({
    id: PLAYBOOK_ID,
    current_version_id: version.id,
  })

  console.log(
    "[seed-knowledge] DONE",
    JSON.stringify({
      kb_created: created,
      total_chunks: chunks,
      ava_version: nextVersion,
      tools: toolNames,
    })
  )
}
