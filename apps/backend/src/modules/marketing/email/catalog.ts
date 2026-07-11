/**
 * email/catalog — the DEFAULT store email templates every shop gets.
 *
 * This is the fixed, keyed catalog of store-facing emails (order confirmation,
 * shipping, account, etc.). Each entry ships a ready-to-send default (subject +
 * body). A shop "has" all of these automatically — no per-tenant rows are
 * created up front. When a merchant edits one, we store a single override row in
 * `marketing_email_template` keyed by (tenant_id, key); the resolver returns the
 * override when present, else the code default (see catalog-resolver.ts).
 *
 * Bodies are the INNER content only ({{token}} placeholders allowed). They are
 * always wrapped by the shared, deliverability-safe layout at render time, so a
 * merchant can never break the chrome, unsubscribe link, or CAN-SPAM footer.
 */

export type CatalogToken = {
  /** The {{token}} name (without braces). */
  token: string
  /** Human label shown in the editor's token palette. */
  label: string
  /** Sample value used in previews / test sends. */
  sample: string
}

export type CatalogTemplate = {
  key: string
  kind: "transactional" | "recovery" | "broadcast"
  /** Grouping in the dashboard. */
  category: "Order" | "Account" | "Marketing"
  title: string
  description: string
  /** The event that auto-sends this email (null = merchant-initiated only). */
  trigger:
    | "order.placed"
    | "order.shipped"
    | "order.delivered"
    | "order.canceled"
    | "order.refunded"
    | "customer.created"
    | "customer.password_reset"
    | null
  defaultSubject: string
  /** Large heading above the body (optional). */
  defaultHeading?: string
  /** Inner body HTML with {{tokens}}. */
  defaultBody: string
  /** Optional call-to-action button. `url` may be a {{token}}. */
  cta?: { text: string; url: string }
  tokens: CatalogToken[]
}

// Tokens common to every store email.
const COMMON_TOKENS: CatalogToken[] = [
  { token: "store_name", label: "Store name", sample: "Larkley" },
  { token: "store_url", label: "Store URL", sample: "https://larkley.mautomate.ai" },
  { token: "first_name", label: "Customer first name", sample: "Alex" },
]

const ORDER_TOKENS: CatalogToken[] = [
  { token: "order_number", label: "Order number", sample: "1042" },
  { token: "order_total", label: "Order total", sample: "$84.00" },
  { token: "order_items", label: "Order items (list)", sample: "2x Cotton Tee, 1x Cap" },
  { token: "order_url", label: "Order status link", sample: "https://larkley.mautomate.ai/account/orders" },
]

export const EMAIL_CATALOG: CatalogTemplate[] = [
  {
    key: "order_confirmation",
    kind: "transactional",
    category: "Order",
    title: "Order confirmation",
    description: "Sent to the customer the moment they place an order.",
    trigger: "order.placed",
    defaultSubject: "Your {{store_name}} order #{{order_number}} is confirmed",
    defaultHeading: "Thanks for your order!",
    defaultBody: `
      <p style="margin:0 0 16px 0;">Hi {{first_name}}, we've received your order and we're getting it ready.</p>
      <p style="margin:0 0 8px 0;"><strong>Order #{{order_number}}</strong></p>
      <p style="margin:0 0 8px 0;">{{order_items}}</p>
      <p style="margin:0 0 16px 0;"><strong>Total: {{order_total}}</strong></p>
      <p style="margin:0 0 8px 0;">We'll email you again as soon as it ships.</p>
    `.trim(),
    cta: { text: "View your order", url: "{{order_url}}" },
    tokens: [...COMMON_TOKENS, ...ORDER_TOKENS],
  },
  {
    key: "order_shipped",
    kind: "transactional",
    category: "Order",
    title: "Order shipped",
    description: "Sent when the order (or part of it) ships.",
    trigger: "order.shipped",
    defaultSubject: "Your {{store_name}} order #{{order_number}} is on the way",
    defaultHeading: "Your order has shipped",
    defaultBody: `
      <p style="margin:0 0 16px 0;">Good news {{first_name}} — your order #{{order_number}} is on its way!</p>
      <p style="margin:0 0 8px 0;">{{order_items}}</p>
      <p style="margin:0 0 16px 0;">You can track your delivery using the link below.</p>
    `.trim(),
    cta: { text: "Track your order", url: "{{tracking_url}}" },
    tokens: [
      ...COMMON_TOKENS,
      ...ORDER_TOKENS,
      { token: "tracking_url", label: "Tracking link", sample: "https://track.example.com/XYZ" },
      { token: "tracking_number", label: "Tracking number", sample: "1Z999AA10123456784" },
    ],
  },
  {
    key: "order_delivered",
    kind: "transactional",
    category: "Order",
    title: "Order delivered",
    description: "Sent when the order is marked delivered.",
    trigger: "order.delivered",
    defaultSubject: "Your {{store_name}} order #{{order_number}} was delivered",
    defaultHeading: "Your order has arrived",
    defaultBody: `
      <p style="margin:0 0 16px 0;">Hi {{first_name}}, your order #{{order_number}} has been delivered.</p>
      <p style="margin:0 0 16px 0;">We hope you love it. If anything isn't quite right, just reply to this email.</p>
    `.trim(),
    cta: { text: "View your order", url: "{{order_url}}" },
    tokens: [...COMMON_TOKENS, ...ORDER_TOKENS],
  },
  {
    key: "order_canceled",
    kind: "transactional",
    category: "Order",
    title: "Order canceled",
    description: "Sent when an order is canceled.",
    trigger: "order.canceled",
    defaultSubject: "Your {{store_name}} order #{{order_number}} was canceled",
    defaultHeading: "Your order was canceled",
    defaultBody: `
      <p style="margin:0 0 16px 0;">Hi {{first_name}}, your order #{{order_number}} has been canceled.</p>
      <p style="margin:0 0 16px 0;">If a payment was taken, any refund will be processed to your original payment method. Questions? Just reply to this email.</p>
    `.trim(),
    tokens: [...COMMON_TOKENS, ...ORDER_TOKENS],
  },
  {
    key: "refund_issued",
    kind: "transactional",
    category: "Order",
    title: "Refund issued",
    description: "Sent when a refund is issued for an order.",
    trigger: "order.refunded",
    defaultSubject: "A refund for your {{store_name}} order #{{order_number}}",
    defaultHeading: "Your refund is on its way",
    defaultBody: `
      <p style="margin:0 0 16px 0;">Hi {{first_name}}, we've issued a refund of <strong>{{refund_amount}}</strong> for order #{{order_number}}.</p>
      <p style="margin:0 0 16px 0;">It may take a few business days to appear on your statement, depending on your bank.</p>
    `.trim(),
    tokens: [
      ...COMMON_TOKENS,
      ...ORDER_TOKENS,
      { token: "refund_amount", label: "Refund amount", sample: "$24.00" },
    ],
  },
  {
    key: "welcome",
    kind: "transactional",
    category: "Account",
    title: "Welcome (new customer)",
    description: "Sent when a customer creates an account.",
    trigger: "customer.created",
    defaultSubject: "Welcome to {{store_name}}",
    defaultHeading: "Welcome aboard",
    defaultBody: `
      <p style="margin:0 0 16px 0;">Hi {{first_name}}, welcome to {{store_name}}!</p>
      <p style="margin:0 0 16px 0;">Your account is ready. You'll be the first to hear about new arrivals and member-only offers.</p>
    `.trim(),
    cta: { text: "Start shopping", url: "{{store_url}}" },
    tokens: [...COMMON_TOKENS],
  },
  {
    key: "password_reset",
    kind: "transactional",
    category: "Account",
    title: "Password reset",
    description: "Sent when a customer requests a password reset.",
    trigger: "customer.password_reset",
    defaultSubject: "Reset your {{store_name}} password",
    defaultHeading: "Reset your password",
    defaultBody: `
      <p style="margin:0 0 16px 0;">Hi {{first_name}}, we received a request to reset your {{store_name}} password.</p>
      <p style="margin:0 0 16px 0;">Click the button below to choose a new one. If you didn't ask for this, you can safely ignore this email.</p>
    `.trim(),
    cta: { text: "Reset password", url: "{{reset_url}}" },
    tokens: [
      ...COMMON_TOKENS,
      { token: "reset_url", label: "Password reset link", sample: "https://larkley.mautomate.ai/reset?token=..." },
    ],
  },
]

export const getCatalogTemplate = (key: string): CatalogTemplate | undefined =>
  EMAIL_CATALOG.find((t) => t.key === key)

/** All triggers that auto-send, mapped to their catalog key. */
export const TRIGGER_TO_KEY: Record<string, string> = EMAIL_CATALOG.reduce(
  (acc, t) => {
    if (t.trigger) acc[t.trigger] = t.key
    return acc
  },
  {} as Record<string, string>
)
