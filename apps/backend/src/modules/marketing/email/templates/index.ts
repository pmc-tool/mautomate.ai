/**
 * email/templates — the concrete, on-brand email builders.
 *
 * Each builder returns `{ subject, html }` where the HTML is a complete document
 * produced by {@link renderEmailLayout}. Personalization is expressed as
 * `{{token}}` placeholders (e.g. `{{first_name}}`) that the send-service or the
 * caller resolves via {@link renderHandlebars} at send time — so a single built
 * template can be reused across a whole audience.
 *
 * These builders add NO dependencies: they are pure string composition over the
 * shared layout, keeping every email deliverability-safe (inline styles,
 * table-based, no remote CSS/JS/fonts).
 */

import { renderEmailLayout } from "./layout"

/** HTML-escape a text value for safe interpolation into markup. */
const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

/** The shape every builder returns. */
export type BuiltEmail = {
  subject: string
  html: string
}

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, " +
  "sans-serif"

// ---------------------------------------------------------------------------
// Welcome
// ---------------------------------------------------------------------------

/** Input for {@link welcomeEmail}. */
export type WelcomeEmailInput = {
  brandName: string
  /** Optional greeting name; falls back to a neutral greeting when empty. */
  firstName?: string
  /** On-domain link to start shopping. */
  shopUrl: string
}

/**
 * A friendly first-touch welcome email. `firstName` may be a literal value or a
 * `{{first_name}}` token resolved later.
 */
export const welcomeEmail = (input: WelcomeEmailInput): BuiltEmail => {
  const greetName = input.firstName ? ` ${escapeHtml(input.firstName)}` : ""
  const brand = escapeHtml(input.brandName)

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hi${greetName}, welcome to ${brand}!</p>
    <p style="margin: 0 0 16px 0;">We're thrilled to have you. You now have a front-row seat to new arrivals, member-only offers, and the pieces our community loves most.</p>
    <p style="margin: 0 0 8px 0;">Ready to look around? Your first find is waiting.</p>
  `.trim()

  return {
    subject: `Welcome to ${input.brandName}`,
    html: renderEmailLayout({
      brandName: input.brandName,
      preheader: `You're in. Here's what's next at ${input.brandName}.`,
      heading: "Welcome aboard",
      bodyHtml,
      ctaText: "Start shopping",
      ctaUrl: input.shopUrl,
    }),
  }
}

// ---------------------------------------------------------------------------
// Broadcast
// ---------------------------------------------------------------------------

/** Input for {@link broadcastEmail}. */
export type BroadcastEmailInput = {
  brandName: string
  heading: string
  /** Trusted HTML body (e.g. from the AI copy service or an editor). */
  bodyHtml: string
  ctaText?: string
  ctaUrl?: string
}

/**
 * A general one-to-many broadcast (newsletter / announcement). The caller owns
 * the body HTML; the layout supplies the on-brand chrome + footer.
 */
export const broadcastEmail = (input: BroadcastEmailInput): BuiltEmail => {
  return {
    subject: input.heading,
    html: renderEmailLayout({
      brandName: input.brandName,
      preheader: input.heading,
      heading: input.heading,
      bodyHtml: input.bodyHtml,
      ctaText: input.ctaText,
      ctaUrl: input.ctaUrl,
    }),
  }
}

// ---------------------------------------------------------------------------
// Cart recovery
// ---------------------------------------------------------------------------

/** A single cart line rendered in the recovery email. */
export type CartRecoveryItem = {
  title: string
  /** Optional remote thumbnail URL. */
  image?: string
  /** Optional pre-formatted price string (e.g. "$29.00"). */
  price?: string
}

/** Input for {@link cartRecoveryEmail}. */
export type CartRecoveryEmailInput = {
  brandName: string
  /** Escalation stage: 1 (gentle) → 2 (nudge) → 3 (incentive). */
  step: 1 | 2 | 3
  firstName?: string
  items: CartRecoveryItem[]
  /** On-domain link that resumes the exact cart. */
  cartUrl: string
  /** Discount code revealed at step 3. */
  discountCode?: string
  /** Human copy describing the discount (e.g. "10% off your order"). */
  discountText?: string
}

/** Render the cart line items as a compact table (thumbnail + title + price). */
const renderCartItems = (items: CartRecoveryItem[]): string => {
  const rows = (items || [])
    .map((item) => {
      const title = escapeHtml(item.title)
      const price = item.price ? escapeHtml(item.price) : ""
      const thumb = item.image
        ? `<img src="${escapeHtml(item.image)}" width="56" height="56" alt="" style="display: block; width: 56px; height: 56px; border-radius: 8px; object-fit: cover; background-color: #f0f0f3;">`
        : `<div style="width: 56px; height: 56px; border-radius: 8px; background-color: #f0f0f3;">&nbsp;</div>`
      const priceCell = price
        ? `<td width="90" align="right" style="font-family: ${FONT_STACK}; font-size: 15px; font-weight: 600; color: #1a1a1a; white-space: nowrap;">${price}</td>`
        : `<td width="90">&nbsp;</td>`
      return `
        <tr>
          <td width="56" style="padding: 8px 0;">${thumb}</td>
          <td style="padding: 8px 12px; font-family: ${FONT_STACK}; font-size: 15px; line-height: 1.4; color: #374151;">${title}</td>
          ${priceCell}
        </tr>`
    })
    .join("")

  if (!rows) {
    return ""
  }

  return `
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 8px 0 20px 0; border-top: 1px solid #eeeef1; border-bottom: 1px solid #eeeef1;">
      ${rows}
    </table>`.trim()
}

/**
 * A 3-step abandoned-cart recovery email with escalating urgency. Step 3 reveals
 * the discount (`discountCode` / `discountText`). `cartUrl` is the on-domain
 * link that resumes the exact cart.
 */
export const cartRecoveryEmail = (input: CartRecoveryEmailInput): BuiltEmail => {
  const greetName = input.firstName ? ` ${escapeHtml(input.firstName)}` : ""
  const itemsTable = renderCartItems(input.items)

  let subject: string
  let heading: string
  let preheader: string
  let lead: string

  if (input.step === 1) {
    subject = "You left something behind"
    heading = "Still thinking it over?"
    preheader = "Your cart is saved and ready when you are."
    lead = `Hi${greetName}, you left a few things in your cart. No rush — we saved them for you.`
  } else if (input.step === 2) {
    subject = "Your cart is about to expire"
    heading = "Don't miss out"
    preheader = "Popular items sell out — grab yours before they're gone."
    lead = `Hi${greetName}, your picks are still waiting, but they're going fast. Complete your order before they sell out.`
  } else {
    subject = "A little something to help you decide"
    heading = "Here's a treat, on us"
    preheader = "An exclusive discount to complete your order."
    lead = `Hi${greetName}, we'd love to see these reach your door — so here's a little something to make it easier.`
  }

  let discountBlock = ""
  if (input.step === 3 && (input.discountCode || input.discountText)) {
    const text = input.discountText
      ? escapeHtml(input.discountText)
      : "a special discount"
    const codeBlock = input.discountCode
      ? `<div style="margin: 10px 0 0 0; font-family: ${FONT_STACK}; font-size: 20px; font-weight: 700; letter-spacing: 2px; color: #1a1a1a;">${escapeHtml(
          input.discountCode
        )}</div>`
      : ""
    discountBlock = `
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 4px 0 20px 0;">
        <tr>
          <td align="center" style="padding: 18px; background-color: #f6f3ff; border: 1px dashed #6d4cf0; border-radius: 10px; font-family: ${FONT_STACK}; font-size: 15px; color: #4b3fb0;">
            Use <strong>${text}</strong> at checkout
            ${codeBlock}
          </td>
        </tr>
      </table>`
  }

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">${lead}</p>
    ${itemsTable}
    ${discountBlock}
    <p style="margin: 0 0 8px 0;">Pick up right where you left off — your cart is one click away.</p>
  `.trim()

  return {
    subject,
    html: renderEmailLayout({
      brandName: input.brandName,
      preheader,
      heading,
      bodyHtml,
      ctaText: "Return to cart",
      ctaUrl: input.cartUrl,
    }),
  }
}

// ---------------------------------------------------------------------------
// Personalization: a tiny {{key}} / {{obj.key}} replacer
// ---------------------------------------------------------------------------

/** Resolve a dotted path (e.g. "customer.first_name") against a context object. */
const lookupPath = (
  context: Record<string, unknown>,
  path: string
): unknown => {
  const parts = path.split(".")
  let current: unknown = context
  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/**
 * Replace `{{key}}` / `{{obj.key}}` tokens in `html` with values from `context`.
 * Supports simple dotted paths; missing keys resolve to an empty string. No
 * loops/conditionals — just key lookup.
 *
 * NOTE: because missing keys blank out, callers that personalize BEFORE the
 * send-service resolves its own tokens (`{{unsubscribe_url}}` /
 * `{{preferences_url}}`) should include those keys in `context` (echoing the
 * placeholder back) so they survive to the send stage.
 */
export const renderHandlebars = (
  html: string,
  context: Record<string, unknown>
): string => {
  if (!html) {
    return ""
  }
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, rawKey: string) => {
    const value = lookupPath(context, String(rawKey).trim())
    if (value === undefined || value === null) {
      return ""
    }
    return String(value)
  })
}
