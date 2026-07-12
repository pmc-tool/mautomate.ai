import { getTenantContext } from "@lib/tenant"

/**
 * The public embed key of the store's ACTIVE chatbot, or null when the store has
 * none. Threaded from the control-plane /tenant-config through the storefront
 * middleware as the x-tenant-chatbot header (the same proven path as theme /
 * region / umami), so a store can only ever get its OWN key.
 *
 * DATA-DRIVEN, NOT ENV-DRIVEN: the widget is mounted iff this returns a key —
 * i.e. iff the merchant has a live chatbot. There is no feature flag to keep in
 * sync with reality.
 *
 * SINGLE-TENANT / LOCAL DEV: with MULTI_TENANT off there is no tenant header, so
 * the key falls back to NEXT_PUBLIC_MARKETING_CHAT_PUBLIC_KEY (set it to a bot's
 * public key to work on the widget locally; unset = no widget).
 */
export async function getChatbotPublicKey(): Promise<string | null> {
  try {
    const ctx = await getTenantContext()
    if (ctx?.chatbotPublicKey) {
      return ctx.chatbotPublicKey
    }
    if (ctx) {
      // Multi-tenant request with no active bot: render nothing (never fall back
      // to another store's / the dev key).
      return null
    }
  } catch {
    // fall through to the single-tenant fallback
  }
  const fallback = process.env.NEXT_PUBLIC_MARKETING_CHAT_PUBLIC_KEY
  return fallback && fallback.trim() ? fallback.trim() : null
}
