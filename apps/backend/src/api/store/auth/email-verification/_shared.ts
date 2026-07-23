import jwt from "jsonwebtoken"
import nodemailer from "nodemailer"

import { PLATFORM_MODULE } from "../../../../modules/platform"

/**
 * Customer email verification — shared plumbing for the check / request /
 * confirm routes.
 *
 * The storefront was built against a verification flow the backend never had
 * (register message, verify-account page, "verification_required" login
 * branch). These helpers complete it:
 *   - the REQUIREMENT is env-gated: CUSTOMER_EMAIL_VERIFICATION=1 makes login
 *     insist on a verified email; unset/0 leaves login untouched (default —
 *     flipping it on makes email delivery a hard dependency of signup).
 *   - verification state lives on customer.metadata.email_verified_at.
 *   - the emailed link carries a purpose-bound JWT (24h) — NOT the login
 *     token, so a leaked link can only verify, never authenticate.
 *   - delivery mirrors the password-reset subscriber: a dedicated transport
 *     (explicit SMTP env or the local sendmail path), independent of the
 *     deliberately-inert marketing email switches.
 */

const TOKEN_PURPOSE = "customer-email-verify"

export const verificationRequired = (): boolean =>
  process.env.CUSTOMER_EMAIL_VERIFICATION === "1"

export const isCustomerVerified = (customer: any): boolean =>
  !!customer?.metadata?.email_verified_at

export function signVerificationToken(
  customerId: string,
  tenantId: string | null,
  email: string
): string | null {
  const secret = process.env.JWT_SECRET
  if (!secret) return null
  return jwt.sign(
    { purpose: TOKEN_PURPOSE, customer_id: customerId, tenant_id: tenantId, email },
    secret,
    { expiresIn: "24h" }
  )
}

export function readVerificationToken(
  token: string
): { customer_id: string; tenant_id: string | null; email: string } | null {
  const secret = process.env.JWT_SECRET
  if (!secret) return null
  try {
    const payload = jwt.verify(token, secret) as any
    if (payload?.purpose !== TOKEN_PURPOSE || !payload?.customer_id) return null
    return {
      customer_id: String(payload.customer_id),
      tenant_id: payload.tenant_id ? String(payload.tenant_id) : null,
      email: String(payload.email ?? ""),
    }
  } catch {
    return null
  }
}

/** The tenant's actually-routed storefront base URL (same logic as the
 *  password-reset subscriber): primary active custom domain, else the free
 *  subdomain, else https://<slug>.<root>. */
export async function storefrontBaseForTenant(
  container: any,
  tenantId: string | null
): Promise<string> {
  const fallback = (process.env.STOREFRONT_URL || "https://mautomate.ai").replace(/\/+$/, "")
  if (!tenantId) return fallback
  try {
    const svc: any = container.resolve(PLATFORM_MODULE)
    const domains: any[] = await svc
      .listTenantDomains({ tenant_id: tenantId })
      .catch(() => [])
    const primary =
      domains.find(
        (d) => d.is_primary && d.type === "custom" && d.ssl_status === "active"
      ) ?? domains.find((d) => d.type === "free")
    if (primary?.domain) return `https://${primary.domain}`
    const tenant = await svc.retrieveTenant(tenantId).catch(() => null)
    if (tenant?.slug) {
      const root = process.env.PLATFORM_ROOT_DOMAIN ?? "mautomate.ai"
      return `https://${tenant.slug}.${root}`
    }
  } catch {
    // fall through
  }
  return fallback
}

const verificationTransport = () => {
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
  return nodemailer.createTransport({
    sendmail: true,
    newline: "unix",
    path: process.env.PLATFORM_ALERT_SENDMAIL_PATH || "/usr/sbin/sendmail",
  })
}

export async function sendVerificationEmail(input: {
  to: string
  verifyUrl: string
  shopName: string
}): Promise<void> {
  const from =
    process.env.PASSWORD_RESET_FROM || "mAutomate <support@mautomate.ai>"
  const { to, verifyUrl, shopName } = input
  await verificationTransport().sendMail({
    from,
    to,
    subject: `Verify your email for ${shopName}`,
    html: `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;">
    <h2 style="margin:0 0 16px 0;font-size:20px;">Verify your email</h2>
    <p style="margin:0 0 16px 0;line-height:1.5;">Thanks for creating an account at ${shopName}. Confirm this email address to finish setting up your account.</p>
    <p style="margin:0 0 24px 0;">
      <a href="${verifyUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">Verify email</a>
    </p>
    <p style="margin:0 0 8px 0;color:#555;font-size:13px;line-height:1.5;">This link expires in 24 hours. If the button does not work, copy this address into your browser:</p>
    <p style="margin:0 0 16px 0;font-size:13px;word-break:break-all;"><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p style="margin:0;color:#888;font-size:12px;">If you did not create this account, you can safely ignore this email.</p>
  </div>
  `.trim(),
    text: [
      "Verify your email",
      "",
      `Thanks for creating an account at ${shopName}.`,
      "Open this link to confirm your email address:",
      verifyUrl,
      "",
      "This link expires in 24 hours.",
      "If you did not create this account, you can safely ignore this email.",
    ].join("\n"),
  })
}
