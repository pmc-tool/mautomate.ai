import { CALL_CENTER_MODULE } from "../modules/call-center"

const TENANT_ID = "ten_01KX1C5HT67VS85MGEVT4A6HQB"
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM" // ElevenLabs "Rachel" (real, multilingual)

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
    "Be a helpful voice concierge for the store: greet callers, answer questions about the store, products, shipping, returns and orders, and make them feel looked-after. Keep the conversation moving and human.",
  first_message:
    "Hi! Thanks for calling. This is Ava, your store assistant. How can I help you today?",
  system_prompt: [
    "You are Ava, a friendly and capable voice assistant for an online store.",
    "You are speaking OUT LOUD on a live phone/voice call, so keep every reply short, warm and natural - usually one or two sentences. Never read out lists, URLs, markdown or code. Spell out prices and numbers the way a person would say them.",
    "You can help with: general questions about the store, product guidance and recommendations, shipping and delivery timelines, returns and exchanges, and the status of an order at a high level.",
    "Be honest about limits. If you do not know something or cannot look it up, say so plainly and offer to take a message or connect them to a human - do NOT invent order numbers, prices, tracking details, stock levels or policies.",
    "Always confirm important details back to the caller before treating them as final (for example an email, an order number, or a spelling).",
    "Stay on topic as a store assistant. If asked something unrelated or inappropriate, gently steer back to how you can help with the store.",
    "One question at a time. Listen, acknowledge what they said, then respond. End the call politely when the caller is done.",
  ].join(" "),
  tools: [],
  guardrails: {
    max_turns: 60,
    max_clarify: 2,
    save_offer_once: true,
    recording_disclosure:
      "Just so you know, this call may be recorded to help us improve our service.",
  },
  disposition_set: [
    "answered_question",
    "took_message",
    "transferred_to_human",
    "no_answer_needed",
    "caller_ended",
  ],
  dtmf_map: {},
}

export default async function createVoiceAgent({ container }: any) {
  const cc: any = container.resolve(CALL_CENTER_MODULE)

  const existing = await cc
    .listPlaybooks({ tenant_id: TENANT_ID })
    .catch(() => [])
  if (Array.isArray(existing) && existing.length) {
    console.log(
      "[create-voice-agent] tenant already has playbooks:",
      existing.map((p: any) => `${p.id}:${p.name}`).join(", ")
    )
    return
  }

  const playbook = await cc.createPlaybooks({
    tenant_id: TENANT_ID,
    name: "Ava - Store Assistant",
    use_case: "customer_support",
    status: "published",
  })

  const version = await cc.createPlaybookVersions({
    tenant_id: TENANT_ID,
    playbook_id: playbook.id,
    version: 1,
    definition,
    published: true,
  })

  await cc.updatePlaybooks({
    id: playbook.id,
    current_version_id: version.id,
  })

  console.log(
    "[create-voice-agent] CREATED",
    JSON.stringify({
      playbook_id: playbook.id,
      version_id: version.id,
      current_version_id: version.id,
      name: playbook.name,
      tenant_id: TENANT_ID,
    })
  )
}
