/**
 * Messaging subsystem bootstrap + public surface. Importing this loads and
 * registers every channel adapter (side-effect imports below). Reach the
 * registry getters + ingest helpers through here. To add a channel: create the
 * adapter under `./providers/<channel>.ts` (it calls `registerMessagingProvider`
 * on load) and add its import to the list below.
 */

// --- Adapter registration ----------------------------------------------------
// (Channel adapters add their side-effect imports here, e.g.
//  import "./providers/web-widget")
import "./providers/web-widget"
import "./providers/telegram"
import "./providers/whatsapp"
import "./providers/messenger"
import "./providers/instagram-dm"

// --- Public surface ----------------------------------------------------------
export {
  getMessagingProvider,
  listMessagingProviders,
  listConfiguredMessagingProviders,
  registerMessagingProvider,
} from "./registry"
export * from "./types"
export {
  ingestInbound,
  recordOutboundMessage,
  resolveTelegramTenantIdBySecret,
} from "./inbound"
export {
  authorizeInboundWebhook,
  TELEGRAM_SECRET_HEADER,
} from "./webhook-auth"
export {
  handleInboundAutoReply,
  AUTO_REPLY_DAILY_CAP_PER_TENANT,
  HANDOFF_HOLDING_MESSAGE,
} from "./auto-reply"
export type { AutoReplyOutcome } from "./auto-reply"
