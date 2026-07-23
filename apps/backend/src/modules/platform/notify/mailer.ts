/**
 * Dedicated transactional transport for platform → merchant mail. Mirrors the
 * password-reset subscriber on purpose: it uses its OWN transport and never
 * depends on (nor enables) the merchant marketing SMTP path, and it NEVER
 * throws (a delivery failure must never break a webhook, a job, or a signup).
 *
 * Transport preference:
 *   1. PLATFORM_ALERT_SMTP_* / SMTP_* (explicit host, e.g. mail.mautomate.ai)
 *   2. local sendmail(8) fallback (the proven local delivery path on this box)
 */

import nodemailer from "nodemailer"

let cached: nodemailer.Transporter | null = null

const buildTransport = (): nodemailer.Transporter => {
  const host =
    process.env.PLATFORM_ALERT_SMTP_HOST ||
    process.env.SMTP_HOST ||
    process.env.PASSWORD_RESET_SMTP_HOST
  if (host) {
    const port = Number(
      process.env.PLATFORM_ALERT_SMTP_PORT ?? process.env.SMTP_PORT ?? 587
    )
    const user =
      process.env.PLATFORM_ALERT_SMTP_USER || process.env.SMTP_USER
    const pass =
      process.env.PLATFORM_ALERT_SMTP_PASS || process.env.SMTP_PASS
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      ...(user && pass ? { auth: { user, pass } } : {}),
      tls: { rejectUnauthorized: false },
    })
  }
  return nodemailer.createTransport({
    sendmail: true,
    newline: "unix",
    path: process.env.PLATFORM_ALERT_SENDMAIL_PATH || "/usr/sbin/sendmail",
  })
}

const transport = (): nodemailer.Transporter => (cached ??= buildTransport())

const fromAddress = (): string =>
  process.env.PLATFORM_MAIL_FROM ||
  process.env.SMTP_FROM ||
  "mAutomate <noreply@mautomate.ai>"

export type SendResult = { ok: boolean; error?: string }

/** Send one transactional email. Never throws — returns {ok}. */
export const sendPlatformMail = async (
  msg: { to: string; subject: string; html: string; text?: string },
  logger?: any
): Promise<SendResult> => {
  try {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msg.to)) {
      return { ok: false, error: "invalid recipient" }
    }
    await transport().sendMail({
      from: fromAddress(),
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      ...(msg.text ? { text: msg.text } : {}),
    })
    return { ok: true }
  } catch (e: any) {
    logger?.error?.(`[platform-mail] send failed (swallowed): ${e?.message ?? e}`)
    return { ok: false, error: e?.message ?? String(e) }
  }
}
