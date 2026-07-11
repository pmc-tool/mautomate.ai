import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

// The admin bundle can't read process.env, so this endpoint reports which
// integration secrets/flags are configured (booleans only — never the values)
// plus the current operating defaults, for the Settings screen.
const has = (key: string): boolean =>
  Boolean(process.env[key] && String(process.env[key]).length > 0)

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  res.json({
    env: {
      CALL_CENTER_ENABLED: process.env.CALL_CENTER_ENABLED === "true",
      CALL_CENTER_SHADOW_MODE: process.env.CALL_CENTER_SHADOW_MODE === "true",
      OPENAI_API_KEY: has("OPENAI_API_KEY"),
      DEEPGRAM_API_KEY: has("DEEPGRAM_API_KEY"),
      ELEVENLABS_API_KEY: has("ELEVENLABS_API_KEY"),
      TWILIO_ACCOUNT_SID: has("TWILIO_ACCOUNT_SID"),
      TWILIO_AUTH_TOKEN: has("TWILIO_AUTH_TOKEN"),
      TWILIO_FROM_NUMBER: has("TWILIO_FROM_NUMBER"),
      TELEPHONY_WEBHOOK_SECRET: has("TELEPHONY_WEBHOOK_SECRET"),
      VOICE_AGENT_URL: has("VOICE_AGENT_URL"),
      REDIS_URL: has("REDIS_URL"),
    },
    defaults: {
      tenant: resolveTenantId("CALL_CENTER_DEFAULT_TENANT"),
      locale: "bn",
      stt: "deepgram",
      tts: "elevenlabs",
      llm: "openai",
    },
    business_hours: { start: "10:00", end: "19:00", tz: "Asia/Dhaka" },
    quiet_hours: { start: "20:00", end: "09:00", tz: "Asia/Dhaka" },
  })
}
