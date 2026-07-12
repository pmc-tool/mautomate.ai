import { getChatbotPublicKey } from "@lib/data/chat"
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

const ChatWidgetMount = async () => {
  const publicKey = await getChatbotPublicKey()
  if (!publicKey) {
    return null
  }
  const config = await loadConfig(publicKey)
  if (!config) {
    return null
  }
  return <ChatWidget publicKey={publicKey} config={config} />
}

export default ChatWidgetMount
