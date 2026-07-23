/**
 * Password-reset email delivery (Medusa `auth.password_reset` event).
 *
 * Medusa v2 emailpass already exposes the reset flow end-to-end:
 *   REQUEST:  POST /auth/{merchant,customer,user}/emailpass/reset-password
 *             body { identifier, metadata? } -> always 201 (no user enumeration)
 *   CONFIRM:  POST /auth/{merchant,customer,user}/emailpass/update
 *             header Authorization: Bearer <token>, body { password }
 * The REQUEST step mints a single-use, 15-minute JWT and emits
 * `auth.password_reset` with { entity_id, actor_type, token, metadata }, but
 * Medusa ships NO delivery, so no persona could ever receive the link. This
 * subscriber is that missing delivery step.
 *
 * SAFETY / DESIGN
 * - Security email, not marketing: it must be delivered EVEN THOUGH the
 *   marketing / store-email paths are deliberately inert on this box (an unset
 *   SMTP_HOST keeps the SmtpEmailProvider dormant). So, exactly like the
 *   platform-health alert job, it uses its OWN transport and by default hands
 *   the message to the local Postfix via sendmail(8) -- the proven-working local
 *   delivery path here -- WITHOUT flipping the switch that would turn on customer
 *   marketing email. It also bypasses the marketing suppression list and
 *   click-tracking (which would otherwise rewrite/obscure the reset link).
 * - NEVER throws: a delivery failure must not break the auth flow or poison the
 *   event retry loop. Failures are logged and swallowed.
 * - Correct per-tenant host, resolved SERVER-SIDE ONLY (never from event
 *   metadata, so a crafted request cannot point the token at an attacker host):
 *     customer -> that store storefront domain (resolveStoreUrl). The customer
 *                 auth identity is tenant-namespaced upstream, so entity_id
 *                 arrives as "<tenant_id>:<email>"; we split it back.
 *     merchant -> the merchant dashboard host (/dashboard/reset-password).
 *     user     -> the super-admin console host (/reset-password).
 * - The reset TOKEN is untouched (single-use, expiring, actor-bound -- Medusa
 *   owns that security). We only email the link.
 */

import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import nodemailer from "nodemailer"

import { resolveStoreUrl } from "../modules/marketing/brand"
import { PLATFORM_MODULE } from "../modules/platform"

/**
 * The tenant's ACTUALLY-ROUTED storefront host, from the control-plane
 * tenant_domain table (primary active custom domain, else the free
 * <slug>.mautomate.ai subdomain). resolveStoreUrl reads the merchant-set
 * marketing `store_url` setting, which most tenants never set — its env /
 * "store.example.com" fallbacks produced reset links pointing at hosts with no
 * /reset-password route (the reported 404). Only a host from this table (or
 * the slug) is guaranteed to serve the storefront, whose middleware then
 * country-prefixes the path while preserving the token query.
 */
async function tenantStorefrontBase(
  container: any,
  tenantId: string
): Promise<string | null> {
  try {
    const svc: any = container.resolve(PLATFORM_MODULE)
    const domains: any[] = await svc
      .listTenantDomains({ tenant_id: tenantId })
      .catch(() => [])
    const primary =
      domains.find(
        (d) =>
          d.is_primary && d.type === "custom" && d.ssl_status === "active"
      ) ?? domains.find((d) => d.type === "free")
    if (primary?.domain) return `https://${primary.domain}`
    const tenant = await svc.retrieveTenant(tenantId).catch(() => null)
    if (tenant?.slug) {
      const root = process.env.PLATFORM_ROOT_DOMAIN ?? "mautomate.ai"
      return `https://${tenant.slug}.${root}`
    }
  } catch {
    // fall through — caller uses resolveStoreUrl
  }
  return null
}

type PasswordResetData = {
  entity_id?: string
  actor_type?: string
  token?: string
  metadata?: Record<string, unknown>
}

const safeLogger = (container: any): any => {
  try {
    return container.resolve("logger")
  } catch {
    return null
  }
}

const stripSlash = (u: string): string => u.replace(/\/+$/, "")

/** Merchant dashboard app host (single central SaaS host). */
const dashboardUrl = (): string =>
  stripSlash(
    process.env.MERCHANT_DASHBOARD_URL ||
      process.env.STOREFRONT_URL ||
      "https://mautomate.ai"
  )

/** Super-admin console host. */
const consoleUrl = (): string =>
  stripSlash(
    process.env.CONSOLE_URL ||
      process.env.STOREFRONT_URL ||
      "https://mautomate.ai"
  )

const isValidEmail = (v: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

const queryString = (token: string, email: string): string =>
  `token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`

/**
 * Dedicated reset transport -- mirrors the platform-alert job on purpose so it
 * never depends on (nor enables) the marketing SMTP path. Prefers explicit
 * reset/alert SMTP env; otherwise delivers through the local sendmail binary.
 */
const resetTransport = () => {
  const host =
    process.env.PASSWORD_RESET_SMTP_HOST || process.env.PLATFORM_ALERT_SMTP_HOST
  if (host) {
    const port = Number(
      process.env.PASSWORD_RESET_SMTP_PORT ??
        process.env.PLATFORM_ALERT_SMTP_PORT ??
        587
    )
    const user =
      process.env.PASSWORD_RESET_SMTP_USER || process.env.PLATFORM_ALERT_SMTP_USER
    const pass =
      process.env.PASSWORD_RESET_SMTP_PASS || process.env.PLATFORM_ALERT_SMTP_PASS
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      ...(user && pass ? { auth: { user, pass } } : {}),
      tls: { rejectUnauthorized: false },
    })
  }
  // Default: hand the message to the local mail system via sendmail, exactly as
  // the provider-health alert does (the local smtpd greeting is unreliable here,
  // but the sendmail path queues + delivers fine).
  return nodemailer.createTransport({
    sendmail: true,
    newline: "unix",
    path: process.env.PLATFORM_ALERT_SENDMAIL_PATH || "/usr/sbin/sendmail",
  })
}

const renderHtml = (resetUrl: string): string =>
  `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;">
    <h2 style="margin:0 0 16px 0;font-size:20px;">Reset your password</h2>
    <p style="margin:0 0 16px 0;line-height:1.5;">We received a request to reset the password for your mAutomate account. Click the button below to choose a new one.</p>
    <p style="margin:0 0 24px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">Reset password</a>
    </p>
    <p style="margin:0 0 16px 0;line-height:1.5;font-size:14px;color:#555;">This link expires in 15 minutes and can be used once. If you did not request a password reset, you can safely ignore this email -- your password will not change.</p>
    <p style="margin:0 0 8px 0;line-height:1.5;font-size:13px;color:#777;">If the button does not work, copy and paste this link into your browser:</p>
    <p style="margin:0 0 24px 0;word-break:break-all;font-size:13px;"><a href="${resetUrl}" style="color:#2563eb;">${resetUrl}</a></p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
    <p style="margin:0;font-size:12px;color:#999;">Need help? Contact <a href="mailto:support@mautomate.ai" style="color:#999;">support@mautomate.ai</a>. Sent by mAutomate.</p>
  </div>
  `.trim()

const renderText = (resetUrl: string): string =>
  [
    "Reset your password",
    "",
    "We received a request to reset the password for your mAutomate account.",
    "Open this link to choose a new one:",
    resetUrl,
    "",
    "This link expires in 15 minutes and can be used once.",
    "If you did not request a password reset, you can safely ignore this email.",
    "",
    "Need help? Contact support@mautomate.ai. Sent by mAutomate.",
  ].join("\n")

export default async function passwordResetHandler({
  event: { data },
  container,
}: SubscriberArgs<PasswordResetData>) {
  const logger = safeLogger(container)
  try {
    const actorType = String(data?.actor_type ?? "").toLowerCase()
    const token = data?.token
    const rawEntity = String(data?.entity_id ?? "")
    if (!token || !rawEntity) return

    let email = rawEntity
    let resetUrl = ""

    if (actorType === "customer") {
      // Customer auth identity is tenant-namespaced upstream: "<tenant_id>:<email>".
      const idx = rawEntity.indexOf(":")
      const tenantId = idx > 0 ? rawEntity.slice(0, idx) : null
      email = idx > 0 ? rawEntity.slice(idx + 1) : rawEntity
      const base = tenantId
        ? stripSlash(
            (await tenantStorefrontBase(container, tenantId)) ??
              (await resolveStoreUrl(container, tenantId))
          )
        : stripSlash(process.env.STOREFRONT_URL || "https://mautomate.ai")
      resetUrl = `${base}/reset-password?${queryString(token, email)}`
    } else if (actorType === "merchant") {
      resetUrl = `${dashboardUrl()}/dashboard/reset-password?${queryString(
        token,
        email
      )}`
    } else {
      // "user" (super-admin console) or any other actor type.
      resetUrl = `${consoleUrl()}/reset-password?${queryString(token, email)}`
    }

    if (!isValidEmail(email)) {
      logger?.warn?.(
        `[password-reset] skipped: resolved recipient is not an email (actor_type ${actorType})`
      )
      return
    }

    const from = process.env.PASSWORD_RESET_FROM || "mAutomate <support@mautomate.ai>"
    await resetTransport().sendMail({
      from,
      to: email,
      subject: "Reset your mAutomate password",
      html: renderHtml(resetUrl),
      text: renderText(resetUrl),
    })
    logger?.info?.(
      `[password-reset] reset link emailed (actor_type ${actorType})`
    )
  } catch (e: any) {
    // Never throw into the auth flow / event loop -- log only.
    logger?.error?.(
      `[password-reset] delivery failed (swallowed): ${e?.message ?? e}`
    )
  }
}

export const config: SubscriberConfig = { event: "auth.password_reset" }
