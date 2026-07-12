/**
 * Telegram inbound DM webhook — `POST /webhooks/marketing/telegram`.
 *
 * This is the URL every merchant's bot is registered against at connect time
 * (`/merchant/marketing/accounts/connect` -> Telegram `setWebhook`, with a
 * per-bot `secret_token`). It is OPEN at the middleware perimeter (like
 * `/webhooks/payment/*`): Telegram cannot present a merchant session, so the
 * request authenticates ITSELF.
 *
 * ── AUTH / TENANT ATTRIBUTION (fail closed) ─────────────────────────────────
 * A Telegram update carries NO receiving-bot identifier in its payload, so the
 * bot — and therefore the owning store — is identified by the per-bot
 * `x-telegram-bot-api-secret-token` header. `authorizeInboundWebhook` matches it
 * TIMING-SAFELY against every connected bot's stored `meta.webhook_secret`
 * (marketing_social_account, platform "telegram") and returns the SINGLE owning
 * tenant. No match, an ambiguous cross-tenant match, or a missing header -> the
 * update is REJECTED with 401 before anything is read or written. There is no
 * "first active account" fallback and no default tenant.
 *
 * The 401 body is empty and identical for every failure mode, so a prober cannot
 * distinguish "no such bot" from "wrong secret".
 *
 * ── ACK FAST ────────────────────────────────────────────────────────────────
 * Telegram retries aggressively on any non-2xx and will back off / disable a slow
 * webhook, so an AUTHORIZED update is always acked 200:
 *   - unsupported update kinds (edited_message, callback_query, channel_post,
 *     …) parse to zero messages and are acked, not retried;
 *   - a parse/ingest failure is logged and acked (never 500).
 * The AI auto-reply is fired-and-forgotten INSIDE `ingestInbound`
 * (`triggerAutoReply`), so this handler never waits on an LLM call.
 *
 * Idempotency is the shared pipeline's: the provider emits a stable
 * `externalEventId` (`tg_<update_id>`) and `externalMessageId`
 * (`tg_<chat_id>_<message_id>`), which `ingestInbound` dedupes against
 * marketing_webhook_event / marketing_message (both tenant-unique).
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import {
  authorizeInboundWebhook,
  getMessagingProvider,
  ingestInbound,
} from "../../../../modules/marketing/messaging"
import type { WebhookContext } from "../../../../modules/marketing/messaging"

const CHANNEL = "telegram"

const buildContext = (req: MedusaRequest): WebhookContext => {
  const raw = (req as any).rawBody
  let rawBody = ""
  if (raw != null) {
    rawBody = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw)
  } else {
    try {
      rawBody = JSON.stringify(req.body ?? {})
    } catch {
      rawBody = ""
    }
  }

  return {
    headers: req.headers as Record<string, string | string[] | undefined>,
    rawBody,
    body: req.body ?? null,
    query: (req.query ?? {}) as Record<string, any>,
  }
}

/**
 * POST — receive one Telegram update. Authorize (401 on anything unattributable),
 * normalize, hand to the shared ingest, ack.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const provider = getMessagingProvider(CHANNEL)
  if (!provider) {
    res.status(404).send("")
    return
  }

  const ctx = buildContext(req)

  const tenantId = await authorizeInboundWebhook(req.scope, provider, ctx).catch(
    () => null
  )
  if (!tenantId) {
    // FAIL CLOSED: unknown / invalid / missing secret token. Uniform empty 401 —
    // never reveal whether the bot exists.
    res.status(401).send("")
    return
  }

  try {
    const msgs = provider.parseInbound(ctx)
    if (msgs?.length) {
      // ingestInbound re-resolves the tenant from the same secret (its own fail-
      // closed attribution) and owns idempotency, persistence and the detached
      // auto-reply. It never throws.
      await ingestInbound(req.scope, msgs)
    }
  } catch (e: any) {
    // NO-THROW: a malformed payload must still be acked or Telegram retries it
    // forever.
    // eslint-disable-next-line no-console
    console.error(
      `[telegram-webhook] parse/ingest failed for tenant ${tenantId}: ${
        e?.message ?? e
      }`
    )
  }

  res.status(200).json({ received: true })
}
