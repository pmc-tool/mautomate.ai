/**
 * Email provider contract — the fixed seam the SMTP adapter implements and the
 * send-service + tracking routes depend on. Mirrors the publish/messaging
 * provider pattern: env-gated, stateless, never throws for expected failures.
 *
 * This is the marketing-email transport (broadcasts, journeys, cart recovery),
 * distinct from the inbox "email" MessagingProvider channel: it carries tracking
 * headers, a suppression contract, and per-send accounting.
 */

/** A fully-rendered email ready to hand to a transport. */
export type EmailMessage = {
  to: string
  toName?: string | null
  /** RFC5322 from, e.g. `Our Store <no-reply@store.example.com>`. */
  from: string
  replyTo?: string | null
  subject: string
  /** Rendered, inline-styled, tracking-injected HTML. */
  html: string
  /** Plain-text alternative (auto-derived from html if omitted). */
  text?: string | null
  /** Extra headers — notably List-Unsubscribe / List-Unsubscribe-Post. */
  headers?: Record<string, string>
}

/** The outcome of a single send attempt. */
export type EmailSendResult = {
  ok: boolean
  externalMessageId?: string | null
  error?: {
    message: string
    /** Drives the runner's retry/backoff. */
    retryable: boolean
    /** e.g. "auth", "connection", "rate_limit", "bad_recipient". */
    code?: string
  }
}

/** Static capabilities for UI + pre-flight. */
export type EmailCapabilities = {
  /** How the app-level integration is configured. */
  connect: "smtp" | "api"
  /** Whether the transport can report bounces/complaints via webhook. */
  bounceWebhook: boolean
}

/** The interface every email transport implements. */
export interface EmailProvider {
  readonly name: string
  readonly capabilities: EmailCapabilities
  /**
   * Whether the transport is configured (e.g. SMTP_HOST set). Drives the
   * env-gate: when false the whole email subsystem stays dormant.
   */
  isConfigured(): boolean
  /** Send one message. Never throws for expected failures — returns ok:false. */
  send(msg: EmailMessage): Promise<EmailSendResult>
}
