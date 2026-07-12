/**
 * Inbound webhook AUTHORIZATION — the tenant-attributing gate that runs between
 * a provider's cheap perimeter check (`MessagingProvider.verifyWebhook`) and
 * ingest.
 *
 * WHY A SECOND GATE: `verifyWebhook` is synchronous and DB-less. For the Meta
 * family that is enough (an HMAC over the raw body proves authenticity by
 * itself). For a `secret_token` channel (Telegram) it is NOT: each connected bot
 * registers its OWN per-bot secret at connect time, so there is no single value
 * to compare against without reading `marketing_social_account` — the perimeter
 * check can only assert the header is PRESENT. The authoritative check is here:
 * a timing-safe match of the presented token against every connected bot's
 * stored `meta.webhook_secret` (see `resolveTelegramTenantIdBySecret`), which
 * yields the OWNING TENANT or nothing.
 *
 * FAIL CLOSED: no stored secret matches (or the match spans more than one
 * tenant) -> null -> the route REJECTS the request. There is no "first active
 * account" fallback and no default tenant. An unattributable update never
 * reaches ingest and never writes a row.
 */

import type { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from "../index"
import { resolveTelegramTenantIdBySecret } from "./inbound"
import type { MessagingProvider, WebhookContext } from "./types"

/** Header Telegram presents the per-bot `secret_token` on (setWebhook). */
export const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token"

const headerValue = (
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | null => {
  const raw = headers?.[name] ?? headers?.[name.toLowerCase()]
  if (Array.isArray(raw)) {
    return raw[0] ?? null
  }
  return typeof raw === "string" ? raw : null
}

/**
 * Authorize an inbound webhook request and, for secret-token channels, resolve
 * the tenant it belongs to.
 *
 * Returns the owning tenant id for a secret-token channel, `null` when the
 * request is NOT authorized (the caller must reject), and `undefined` when the
 * channel authenticates by signature alone (Meta HMAC) — those channels attribute
 * per-message inside `ingestInbound` from the receiving Page/IG/WABA id, so there
 * is no single tenant to return here.
 */
export const authorizeInboundWebhook = async (
  container: MedusaContainer,
  provider: MessagingProvider,
  ctx: WebhookContext
): Promise<string | null | undefined> => {
  // (1) Perimeter: the provider's own signature / header check.
  if (!provider.verifyWebhook(ctx)) {
    return null
  }

  // (2) Signature channels are already proven; per-message attribution follows.
  if (provider.capabilities.inboundAuth !== "secret_token") {
    return undefined
  }

  // (3) Secret-token channels: the token IS the identity. Match it, timing-safe,
  //     against the connected bots and take the single owning tenant, or reject.
  const secret = headerValue(ctx.headers, TELEGRAM_SECRET_HEADER)
  if (!secret) {
    return null
  }

  const mk: any = container.resolve(MARKETING_MODULE)
  const tenantId = await resolveTelegramTenantIdBySecret(mk, secret)
  return tenantId ?? null
}
