/**
 * Messaging provider contract — the fixed seam every channel adapter implements
 * and that the webhook routes, the web-widget API, and the inbox depend on. One
 * `MessagingProvider` per channel (whatsapp, messenger, instagram, telegram,
 * web_widget). Adapters own the network + signature specifics; the shared
 * ingest service (`./inbound`) owns idempotency, contact/conversation upsert,
 * and unread bookkeeping.
 *
 * Security: `/marketing-webhooks/*` is OPEN at the perimeter, so `verifyWebhook`
 * is MANDATORY — an adapter that cannot verify a payload's authenticity must
 * return false and the route must drop the request. `parseInbound` runs only
 * after verification passes.
 *
 * MULTI-TENANT: inbound webhooks are un-authenticated by the SENDER, so the
 * RECEIVING account identifies the owning store. Every normalized inbound
 * message therefore carries a receiving-account identifier
 * (`receivingAccountExternalId` for the Meta family, `receivingAccountSecret`
 * for Telegram) that `./inbound` resolves to a tenant via
 * marketing_social_account. A message that cannot be attributed is DROPPED —
 * never written to a shared/default tenant.
 */

/** Channel identifiers — mirror the conversation.channel enum. */
export type MessagingChannel =
  | "whatsapp"
  | "messenger"
  | "instagram"
  | "telegram"
  | "web_widget"
  | "email"
  | "review"

/** A media attachment on an inbound/outbound message. */
export type MessageMedia = {
  url: string
  kind: "image" | "video" | "audio" | "file"
  mime?: string | null
  alt?: string | null
}

/** Raw request context handed to `verifyWebhook` / `parseInbound`. */
export type WebhookContext = {
  headers: Record<string, string | string[] | undefined>
  /** The exact raw request body string (required for HMAC signature checks). */
  rawBody: string
  /** The parsed JSON body (convenience; may be null for non-JSON). */
  body: any
  query: Record<string, any>
}

/** One normalized inbound message, channel-agnostic. */
export type InboundMessage = {
  channel: MessagingChannel
  /** Stable per-channel event id for idempotent webhook dedup. */
  externalEventId: string
  /** The conversation/thread key on the provider (sender or thread id). */
  externalThreadId: string
  /** The provider's message id (dedup at the message level). */
  externalMessageId: string | null
  /** The sender's stable external id (psid, wa id, chat id, …). */
  senderExternalId: string
  /**
   * The RECEIVING account's stable external id on the provider — the Facebook
   * Page id (messenger), the Instagram account id (instagram), or the WhatsApp
   * Business Account id (whatsapp). This attributes an inbound message to the
   * owning tenant via marketing_social_account.(platform, external_id).
   *
   * `null` when the payload carries no receiving-account id: session channels
   * (web_widget) resolve tenant upstream, and Telegram resolves via
   * `receivingAccountSecret` instead. A `null` here on an external channel means
   * the message is unattributable and MUST be dropped (see `./inbound`).
   */
  receivingAccountExternalId: string | null
  /**
   * Telegram only: the per-bot webhook secret token presented on the request
   * (`x-telegram-bot-api-secret-token`). Resolves the receiving bot's tenant via
   * marketing_social_account.meta.webhook_secret. Never persisted.
   */
  receivingAccountSecret?: string | null
  senderName?: string | null
  senderAvatar?: string | null
  senderPhone?: string | null
  senderEmail?: string | null
  text: string | null
  media: MessageMedia[]
  sentAt: Date
}

/** Decrypted credentials + account context for OUTBOUND sends. */
export type MessagingCredentials = {
  accessToken: string | null
  meta: Record<string, any> | null
}

/** An outbound reply an agent/AI sends back to a contact. */
export type OutboundMessage = {
  channel: MessagingChannel
  /** Provider thread/recipient id (conversation.external_thread_id). */
  externalThreadId: string
  credentials: MessagingCredentials
  text: string | null
  media: MessageMedia[]
}

/** Result of an outbound send. */
export type SendResult = {
  ok: boolean
  externalMessageId?: string | null
  deliveryStatus?: string | null
  error?: { message: string; retryable: boolean; code?: string }
}

/** Static description of a channel's constraints, for UI + pre-flight. */
export type MessagingCapabilities = {
  /** Whether the channel needs app-level config (env keys) to receive/send. */
  requiresAppConfig: boolean
  maxTextLength: number | null
  supportsMedia: boolean
  /** How inbound is authenticated: "hmac" (Meta), "secret_token" (telegram),
   *  "session" (web widget, no signature — a conversation token gates it). */
  inboundAuth: "hmac" | "secret_token" | "session"
}

export interface MessagingProvider {
  readonly channel: MessagingChannel
  readonly label: string
  readonly capabilities: MessagingCapabilities
  /** Whether the app-level integration is configured (drives connect UI). */
  isConfigured(): boolean
  /**
   * Verify an inbound webhook's authenticity (HMAC / secret token). MUST return
   * false when it cannot positively verify. Session channels (web widget) verify
   * a conversation token upstream and may return true here.
   */
  verifyWebhook(ctx: WebhookContext): boolean
  /**
   * Meta-style GET verification handshake. Return the challenge string to echo
   * (200) when the verify token matches, else null. Non-Meta channels return
   * null.
   */
  verifyChallenge(ctx: WebhookContext): string | null
  /** Normalize a verified webhook payload into zero-or-more inbound messages. */
  parseInbound(ctx: WebhookContext): InboundMessage[]
  /** Send an outbound reply. Never throws for expected failures. */
  sendMessage(input: OutboundMessage): Promise<SendResult>
}
