/**
 * Sub-processor registry (plan §05 / GDPR Art. 28).
 *
 * The authoritative list of third parties that may process tenant/customer data,
 * used to generate the DPA sub-processor schedule and the public sub-processor
 * page. Keep this in code so the DPA never drifts from what the platform
 * actually integrates.
 */
export type SubProcessor = {
  name: string
  purpose: string
  data: string
  region: string
}

export const SUBPROCESSORS: SubProcessor[] = [
  { name: "Cloudflare", purpose: "Edge, TLS, custom hostnames", data: "Request metadata", region: "Global" },
  { name: "Stripe", purpose: "Global payments & subscriptions", data: "Billing contact, payment token", region: "US/EU" },
  { name: "SSLCommerz", purpose: "Bangladesh payments", data: "Billing contact, payment token", region: "BD" },
  { name: "OpenAI", purpose: "AI text generation", data: "Prompt content", region: "US" },
  { name: "Deepgram", purpose: "Speech-to-text", data: "Call audio", region: "US" },
  { name: "ElevenLabs", purpose: "Text-to-speech", data: "Generated speech text", region: "US" },
  { name: "Twilio", purpose: "Telephony & SMS", data: "Phone numbers, call metadata", region: "Global" },
  { name: "ResellerClub", purpose: "Domain registration", data: "Registrant WHOIS contact", region: "Global" },
]

/** Render the sub-processor schedule (for the DPA / public page). */
export const subprocessorSchedule = (): string =>
  SUBPROCESSORS.map(
    (s) => `- ${s.name} — ${s.purpose} (${s.data}; ${s.region})`
  ).join("\n")
