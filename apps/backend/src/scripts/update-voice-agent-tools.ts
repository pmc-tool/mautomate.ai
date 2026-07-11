import { CALL_CENTER_MODULE } from "../modules/call-center"

const PLAYBOOK_ID = "playbook_01KX1TGPK59B571BDADCQAYPN2"
const TENANT_ID = "ten_01KX1C5HT67VS85MGEVT4A6HQB"
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"

// Tool definitions (names MUST match src/modules/call-center/tools/registry.ts).
const tools = [
  {
    name: "findOrders",
    description:
      "Look up the caller's order(s) in this store by the order number they read out, or by the email or phone on the order. Use this whenever the caller asks about an existing order.",
    parameters: {
      type: "object",
      properties: {
        order_number: {
          type: "string",
          description:
            "The order number the caller gives, e.g. '1005' or '#1005'.",
        },
        email: { type: "string", description: "Email on the order." },
        phone: { type: "string", description: "Phone number on the order." },
      },
    },
  },
  {
    name: "listCustomerOrders",
    description:
      "List recent orders for a customer by their email or phone number. Use when the caller cannot remember their order number.",
    parameters: {
      type: "object",
      properties: {
        email: { type: "string" },
        phone: { type: "string" },
      },
    },
  },
  {
    name: "searchProducts",
    description:
      "Search this store's products by keywords to answer questions about what's available, price and stock. Use for 'do you have...', 'how much is...', 'is X in stock'.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keywords describing the product the caller wants.",
        },
        limit: { type: "integer", description: "Max results (default 5)." },
      },
      required: ["query"],
    },
  },
  {
    name: "getProduct",
    description:
      "Get full details (variants, price, stock, description) for one product by its handle, id, or exact title.",
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

const toolNames = tools.map((t) => t.name)

const systemPrompt = [
  "You are Ava, a friendly and capable voice assistant for an online store.",
  "You are speaking OUT LOUD on a live voice call, so keep every reply short, warm and natural - usually one or two sentences. Never read out lists, URLs, markdown or code. Say prices and numbers the way a person naturally would.",
  "YOU CAN LOOK THINGS UP. You have tools to search this store's products and to look up orders. When the caller asks about a product ('do you have', 'how much', 'in stock'), call searchProducts (or getProduct) and answer from the real result - never guess a product, price or stock level. When the caller asks about an order, ask for their order number, or the email or phone on the order, then call findOrders (or listCustomerOrders). Only read out order details after you have looked them up.",
  "IDENTITY: before reading out personal order details (address, items, totals), confirm at least one identifier the caller gave (order number plus email or phone) matches the order you found. If it doesn't match, do not read the details - offer to take a message or transfer to a human.",
  "HONESTY: if a tool returns nothing or an error, say so plainly ('I couldn't find an order with that number') and offer to try another detail, take a message, or connect a human. Never invent an order, tracking number, price, stock level or policy.",
  "PLACING ORDERS: you cannot take payment or place an order on this call yet. You CAN help the caller find the right product, tell them the price and whether it's in stock, and explain how to order on the website - then offer to note their interest or transfer to a human.",
  "Stay on topic as this store's assistant. One question at a time: listen, acknowledge, then respond. End the call politely with endCall when the caller is done.",
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
    "Be a helpful voice concierge for the store: answer product questions (availability, price, stock) from live catalog lookups, look up the caller's orders, and guide them - honestly and never inventing facts.",
  first_message:
    "Hi! Thanks for calling. This is Ava, your store assistant. How can I help you today?",
  system_prompt: systemPrompt,
  tools,
  states: [
    {
      id: "main",
      goal: "Help the caller with products and orders using the lookup tools; verify identity before sharing order details.",
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
    "looked_up_order",
    "took_message",
    "transferred_to_human",
    "no_answer_needed",
    "caller_ended",
  ],
  dtmf_map: {},
}

export default async function updateVoiceAgentTools({ container }: any) {
  const cc: any = container.resolve(CALL_CENTER_MODULE)

  const agent = await cc.retrievePlaybook(PLAYBOOK_ID).catch(() => null)
  if (!agent || agent.tenant_id !== TENANT_ID) {
    console.log("[update-voice-agent-tools] agent not found for tenant")
    return
  }

  // Next version number.
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
    "[update-voice-agent-tools] UPDATED",
    JSON.stringify({
      playbook_id: PLAYBOOK_ID,
      new_version_id: version.id,
      version: nextVersion,
      tools: toolNames,
    })
  )
}
