/**
 * email/templates/layout — the single responsive HTML shell every marketing
 * email is rendered through.
 *
 * DELIVERABILITY / CLIENT-SAFETY RULES baked in here:
 *   - Table-based layout (no flex/grid): Outlook's Word engine only lays out
 *     tables reliably.
 *   - Inline styles on EVERY element: Gmail (and many clients) strip or ignore
 *     much of a <style> block, so inline is the safety net; the <style> block
 *     only carries media queries + a couple of progressive enhancements.
 *   - 600px max centered container: the universally safe email width.
 *   - System font stack: no remote web fonts (privacy/blocked-request safe).
 *   - Hidden preheader span: controls the inbox preview snippet.
 *   - Bulletproof table CTA button: renders as a real filled button even where
 *     CSS padding on <a> is dropped.
 *   - A footer with store name, physical postal address (CAN-SPAM), and an
 *     unsubscribe link using the literal {{unsubscribe_url}} placeholder the
 *     send-service resolves.
 *   - Document ends with </body></html> so the send-service can append the open
 *     pixel just before it.
 *
 * `bodyHtml` is trusted HTML supplied by the caller (already sanitized/built by
 * a template builder) and is injected verbatim; every other text field is HTML-
 * escaped here.
 */

/** Options for {@link renderEmailLayout}. */
export type EmailLayoutOptions = {
  /** Brand / store name shown in the header and footer. */
  brandName?: string
  /** Accent color (buttons, header rule). Defaults to #6d4cf0. */
  accent?: string
  /** Inbox preview snippet (hidden in the body). */
  preheader?: string
  /** Optional large heading rendered above the body. */
  heading?: string
  /** Trusted HTML for the main content area (injected verbatim). */
  bodyHtml: string
  /** Optional CTA button label. Rendered only with `ctaUrl`. */
  ctaText?: string
  /** Optional CTA button destination. Rendered only with `ctaText`. */
  ctaUrl?: string
  /** Optional small note rendered above the legal footer lines. */
  footerNote?: string
}

const DEFAULT_ACCENT = "#6d4cf0"

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, " +
  "sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'"

/** HTML-escape a text value for safe interpolation into markup/attributes. */
const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

/**
 * Render the full email document. Returns a complete, self-contained HTML
 * string ending in `</body></html>`.
 */
export const renderEmailLayout = (opts: EmailLayoutOptions): string => {
  const accent = escapeHtml(opts.accent || DEFAULT_ACCENT)
  const brandName = escapeHtml(opts.brandName || "Our Store")
  const preheader = escapeHtml(opts.preheader || "")
  const heading = opts.heading ? escapeHtml(opts.heading) : ""
  const footerNote = opts.footerNote ? escapeHtml(opts.footerNote) : ""
  const postalAddress = escapeHtml(
    process.env.MARKETING_POSTAL_ADDRESS ||
      "123 Commerce Street, Suite 100, City, State 00000"
  )

  const hasCta = Boolean(opts.ctaText && opts.ctaUrl)
  const ctaText = escapeHtml(opts.ctaText || "")
  const ctaUrl = escapeHtml(opts.ctaUrl || "")

  const headingBlock = heading
    ? `<tr>
              <td style="padding: 0 0 16px 0; font-family: ${FONT_STACK}; font-size: 24px; line-height: 1.3; font-weight: 700; color: #1a1a1a;">
                ${heading}
              </td>
            </tr>`
    : ""

  const ctaBlock = hasCta
    ? `<tr>
              <td style="padding: 8px 0 8px 0;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate;">
                  <tr>
                    <td align="center" bgcolor="${accent}" style="border-radius: 8px;">
                      <a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-family: ${FONT_STACK}; font-size: 16px; font-weight: 600; line-height: 1; color: #ffffff; text-decoration: none; border-radius: 8px; background-color: ${accent};">
                        ${ctaText}
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
    : ""

  const footerNoteBlock = footerNote
    ? `<tr>
              <td style="padding: 0 0 12px 0; font-family: ${FONT_STACK}; font-size: 13px; line-height: 1.5; color: #6b7280;">
                ${footerNote}
              </td>
            </tr>`
    : ""

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${brandName}</title>
  <style>
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    table { border-collapse: collapse; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    a { color: ${accent}; }
    .email-body { background-color: #f4f4f7; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .email-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .email-cta a { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body class="email-body" style="margin: 0; padding: 0; width: 100%; background-color: #f4f4f7; font-family: ${FONT_STACK};">
  <span style="display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0;">${preheader}</span>
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" class="email-container" width="600" border="0" cellpadding="0" cellspacing="0" style="width: 600px; max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td class="email-pad" style="padding: 28px 40px 20px 40px; border-top: 4px solid ${accent};">
              <div style="font-family: ${FONT_STACK}; font-size: 20px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.2px;">
                ${brandName}
              </div>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding: 8px 40px 32px 40px;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" class="email-cta">
                ${headingBlock}
                <tr>
                  <td style="font-family: ${FONT_STACK}; font-size: 16px; line-height: 1.6; color: #374151;">
                    ${opts.bodyHtml}
                  </td>
                </tr>
                ${ctaBlock}
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding: 24px 40px 28px 40px; background-color: #fafafb; border-top: 1px solid #eeeef1;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                ${footerNoteBlock}
                <tr>
                  <td style="font-family: ${FONT_STACK}; font-size: 13px; line-height: 1.5; color: #6b7280;">
                    <strong style="color: #4b5563;">${brandName}</strong><br>
                    ${postalAddress}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0 0 0; font-family: ${FONT_STACK}; font-size: 12px; line-height: 1.5; color: #9ca3af;">
                    You're receiving this because you shopped with us. <a href="{{unsubscribe_url}}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export default renderEmailLayout
