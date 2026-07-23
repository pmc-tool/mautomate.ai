import TwilioNumberProvider from "./twilio-numbers"
import VonageNumberProvider from "./vonage-numbers"
import type { NumberProvider } from "./types"

export * from "./types"
export { TwilioNumberProvider, VonageNumberProvider }

const twilio = new TwilioNumberProvider()
const vonage = new VonageNumberProvider()

/** Resolve a number provider by name; null when unknown. */
export const getNumberProvider = (name: string): NumberProvider | null => {
  switch ((name || "").toLowerCase()) {
    case "twilio":
      return twilio
    case "vonage":
      return vonage
    default:
      return null
  }
}

/** Which providers have platform credentials set — drives the merchant UI. */
export const numberProviderStatus = (): Record<string, boolean> => ({
  twilio: twilio.isConfigured(),
  vonage: vonage.isConfigured(),
})
