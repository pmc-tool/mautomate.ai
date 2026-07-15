import crypto from "crypto"
import { getChatbotPublicKey } from "@lib/data/chat"
import { retrieveCustomer } from "@lib/data/customer"
import ChatWidget from "./chat-widget"

/**
 * Server mount for the live-chat widget — the single place the storefront
 * decides whether a store HAS chat.
 *
 * It is DATA-driven, never env-driven:
 *   1. `getChatbotPublicKey()` yields the request tenant's ACTIVE chatbot public
 *      key (x-tenant-chatbot, forwarded from /tenant-config). No bot -> no key.
 *   2. That key is resolved against the backend's public
 *      `/marketing-chat/config` (404 when the bot is gone/inactive).
 *   3. Only then is the client widget rendered, with its appearance already
 *      resolved — so the bubble ships in the SSR HTML instead of flashing in.
 *
 * Any failure (no tenant, no bot, backend down) renders NOTHING and makes no
 * further requests. It can never break the storefront shell.
 */

type ChatbotConfig = {
  public_key: string
  name: string
  welcome_message: string | null
  bubble_message: string | null
  avatar: string | null
  color: string
  position: "left" | "right"
  show_logo: boolean
  show_datetime: boolean
  embed_width: number
  embed_height: number
  allow_emoji: boolean
  allow_attachments: boolean
  collect_email: boolean
}

/** Server-side fetches prefer the loopback backend; the browser uses the public URL. */
const SERVER_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL_INTERNAL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:9000"

const loadConfig = async (
  publicKey: string
): Promise<ChatbotConfig | null> => {
  try {
    const res = await fetch(
      `${SERVER_BACKEND_URL}/marketing-chat/config?public_key=${encodeURIComponent(
        publicKey
      )}`,
      { cache: "no-store" }
    )
    if (!res.ok) {
      return null
    }
    const data = (await res.json()) as { chatbot?: ChatbotConfig }
    return data.chatbot ?? null
  } catch {
    return null
  }
}

/**
 * Prove to the backend WHO is chatting, without ever trusting the browser.
 *
 * The shopper's auth cookie is httpOnly, so the widget cannot read it — and a
 * `customer_id` posted from client JavaScript would be worthless anyway: anyone
 * could type someone else's. So the SERVER, which has already authenticated the
 * shopper against Medusa, mints a short-lived token bound to their customer id
 * and signs it with a secret only the two servers share. The browser carries it
 * and cannot forge, alter or extend it.
 *
 * No secret configured, or nobody logged in -> no token, and the chat is simply
 * anonymous, exactly as before.
 */
const mintIdentity = async (): Promise<string | null> => {
  const secret = process.env.CHAT_IDENTITY_SECRET
  if (!secret) {
    return null
  }
  try {
    const customer = await retrieveCustomer()
    if (!customer?.id) {
      return null
    }
    const payload = Buffer.from(
      JSON.stringify({ cid: customer.id, exp: Date.now() + 3600_000 })
    ).toString("base64url")
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("base64url")
    return `${payload}.${signature}`
  } catch {
    // A logged-out shopper (or an auth hiccup) is just an anonymous visitor.
    return null
  }
}

const ChatWidgetMount = async () => {
  const publicKey = await getChatbotPublicKey()
  if (!publicKey) {
    return null
  }
  const config = await loadConfig(publicKey)
  if (!config) {
    return null
  }
  const identity = await mintIdentity()
  return (
    <ChatWidget publicKey={publicKey} config={config} identity={identity} />
  )
}

export default ChatWidgetMount
