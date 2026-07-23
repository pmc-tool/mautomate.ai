/**
 * Platform → merchant transactional email layout (the mAutomate SaaS itself
 * emailing the store OWNER about billing, subscription and AI-credit events).
 *
 * This is DELIBERATELY separate from modules/marketing/email/* (that layout is
 * the merchant's STORE emailing its own shoppers, with unsubscribe + open-pixel
 * + tenant/campaign scoping). Platform lifecycle mail is 1:1 transactional to a
 * merchant account, so: no unsubscribe/tracking, mAutomate branding (ember),
 * bulletproof table layout, system-font stack, 600px safe width.
 */

const EMBER = "#F26522"
const INK = "#111827"
const MUTED = "#6b7280"
const LINE = "#eeeef1"
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

const LOGO_URL =
  process.env.PLATFORM_EMAIL_LOGO_URL ||
  "https://mautomate.ai/mautomate-logo.png"

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

export type PlatformEmailOptions = {
  preheader?: string
  heading: string
  /** Trusted HTML body (already built by a template). */
  bodyHtml: string
  ctaText?: string
  ctaUrl?: string
  /** Optional small note above the footer. */
  footerNote?: string
}

/** Render a complete, self-contained mAutomate-branded email document. */
export const renderPlatformEmail = (o: PlatformEmailOptions): string => {
  const heading = esc(o.heading)
  const preheader = esc(o.preheader || "")
  const hasCta = Boolean(o.ctaText && o.ctaUrl)
  const supportEmail =
    process.env.PLATFORM_SUPPORT_EMAIL || "support@mautomate.ai"
  const dashUrl = (
    process.env.MERCHANT_DASHBOARD_URL || "https://mautomate.ai"
  ).replace(/\/+$/, "")

  const cta = hasCta
    ? `<tr><td style="padding:8px 0 8px 0;">
         <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
           <tr><td align="center" bgcolor="${EMBER}" style="border-radius:8px;">
             <a href="${esc(o.ctaUrl)}" target="_blank" style="display:inline-block;padding:13px 30px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:8px;background-color:${EMBER};">${esc(
               o.ctaText
             )}</a>
           </td></tr>
         </table>
       </td></tr>`
    : ""

  const footerNote = o.footerNote
    ? `<tr><td style="padding:0 0 12px 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};">${esc(
        o.footerNote
      )}</td></tr>`
    : ""

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#f4f4f7;font-family:${FONT};">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${preheader}</span>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" border="0" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:28px 40px 18px 40px;border-top:4px solid ${EMBER};">
        <img src="${LOGO_URL}" alt="mAutomate" height="30" style="height:30px;width:auto;display:block;border:0;">
      </td></tr>
      <tr><td style="padding:6px 40px 30px 40px;">
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr><td style="padding:0 0 14px 0;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${INK};">${heading}</td></tr>
          <tr><td style="font-family:${FONT};font-size:15px;line-height:1.6;color:#374151;">${o.bodyHtml}</td></tr>
          ${cta}
        </table>
      </td></tr>
      <tr><td style="padding:22px 40px 26px 40px;background-color:#fafafb;border-top:1px solid ${LINE};">
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
          ${footerNote}
          <tr><td style="font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};">
            <strong style="color:#4b5563;">mAutomate</strong> — Merchant Automation Made Simple<br>
            Manage your plan &amp; credits in your <a href="${dashUrl}/dashboard/billing" style="color:${EMBER};text-decoration:underline;">dashboard</a>.
          </td></tr>
          <tr><td style="padding:10px 0 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:#9ca3af;">
            Questions? Reach us at <a href="mailto:${supportEmail}" style="color:#9ca3af;">${supportEmail}</a>. This is a service notification about your mAutomate account.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

export { esc as escapePlatformHtml }
