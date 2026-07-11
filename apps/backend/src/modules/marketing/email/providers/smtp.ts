/**
 * SMTP email transport — the default first-party marketing sender.
 *
 * Env-gated on SMTP_HOST: when unset, `isConfigured()` is false and the whole
 * email subsystem stays dormant (see registry). Builds ONE lazily-created
 * nodemailer transport and reuses it across sends. Never throws for expected
 * failures — maps common SMTP errors to a retryable/non-retryable EmailSendResult.
 *
 * Self-registers on import (side effect) via `registerEmailProvider`.
 */

import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"
import { registerEmailProvider } from "../registry"
import type {
  EmailCapabilities,
  EmailMessage,
  EmailProvider,
  EmailSendResult,
} from "../types"

export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp"
  readonly capabilities: EmailCapabilities = {
    connect: "smtp",
    bounceWebhook: false,
  }

  private transport: Transporter | null = null

  isConfigured(): boolean {
    return !!process.env.SMTP_HOST
  }

  /** Lazily build (and cache) the single shared transport from env. */
  private getTransport(): Transporter {
    if (this.transport) {
      return this.transport
    }

    const port = Number(process.env.SMTP_PORT ?? 587)
    const secure = process.env.SMTP_SECURE === "true"
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS

    this.transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: secure ? 465 : port,
      secure,
      auth: user ? { user, pass } : undefined,
    })

    return this.transport
  }

  async send(msg: EmailMessage): Promise<EmailSendResult> {
    try {
      const transport = this.getTransport()

      const info = await transport.sendMail({
        from: msg.from,
        to: msg.to,
        replyTo: msg.replyTo ?? undefined,
        subject: msg.subject,
        html: msg.html,
        text: msg.text ?? undefined,
        headers: msg.headers,
      })

      return {
        ok: true,
        externalMessageId: info?.messageId ?? null,
      }
    } catch (e: any) {
      return {
        ok: false,
        error: mapSmtpError(e),
      }
    }
  }
}

/** Map a thrown SMTP/nodemailer error to a retryable/non-retryable result. */
const mapSmtpError = (
  e: any
): NonNullable<EmailSendResult["error"]> => {
  const code = String(e?.code ?? e?.responseCode ?? "").toUpperCase()
  const message = String(e?.message ?? "Failed to send email")

  // Auth failures — not retryable, needs a config fix.
  if (
    code === "EAUTH" ||
    e?.responseCode === 535 ||
    e?.responseCode === 530 ||
    /invalid login|authentication failed|auth/i.test(message)
  ) {
    return { message, retryable: false, code: "auth" }
  }

  // Bad recipient / permanent 5xx rejection — not retryable.
  if (
    code === "EENVELOPE" ||
    (typeof e?.responseCode === "number" &&
      e.responseCode >= 500 &&
      e.responseCode < 600) ||
    /no recipients|recipient|mailbox|address rejected/i.test(message)
  ) {
    return { message, retryable: false, code: "bad_recipient" }
  }

  // Connection / timeout / DNS — transient, retryable.
  if (
    code === "ECONNECTION" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ESOCKET" ||
    code === "EDNS" ||
    code === "ETIMEOUT" ||
    /timeout|timed out|econnrefused|connection|socket|network/i.test(message)
  ) {
    return { message, retryable: true, code: "connection" }
  }

  // Rate limiting — transient, retryable.
  if (
    e?.responseCode === 421 ||
    e?.responseCode === 450 ||
    /rate limit|too many|try again|throttl/i.test(message)
  ) {
    return { message, retryable: true, code: "rate_limit" }
  }

  // Unknown — default to retryable so the runner can back off.
  return { message, retryable: true, code: code ? code.toLowerCase() : "unknown" }
}

// --- Self-registration -------------------------------------------------------
registerEmailProvider(new SmtpEmailProvider())
