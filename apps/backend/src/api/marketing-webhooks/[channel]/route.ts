/**
 * Public inbound platform-webhook surface — `/marketing-webhooks/:channel`.
 *
 * This route is OPEN at the middleware perimeter (see `src/api/middlewares.ts`;
 * the `/marketing-webhooks/*` matcher is intentionally ungated). Authenticity is
 * therefore MANDATORY in-handler: every POST is dropped unless the channel's
 * `MessagingProvider.verifyWebhook` positively verifies it (Meta HMAC over the
 * raw body, Telegram secret-token header). `parseInbound` runs only after that.
 *
 * ── THE RAW-BODY PROBLEM ────────────────────────────────────────────────────
 * Meta signs the EXACT raw request bytes with HMAC-SHA256. Medusa's json body
 * parser consumes the stream before this handler runs, leaving only the parsed
 * object on `req.body`; re-serializing it is NOT guaranteed byte-identical, so a
 * reconstructed HMAC can mismatch a legitimate Meta payload.
 *
 * Medusa DOES expose the exact bytes as `req.rawBody` (a Buffer), but ONLY when
 * the matching route sets `bodyParser: { preserveRawBody: true }` in the root
 * `src/api/middlewares.ts`. That file has NO such entry for `/marketing-webhooks/*`
 * and is owned by the webhook-security agent — this handler may not edit it.
 *
 * So we PREFER `req.rawBody` when present (works the moment the middleware agent
 * adds `preserveRawBody` for this matcher) and otherwise FALL BACK to
 * `JSON.stringify(req.body)`. LIMITATION: with the fallback, Meta HMAC
 * verification can fail on payloads whose canonical serialization differs from
 * ours — to receive Meta channels reliably, `preserveRawBody: true` must be set
 * for `/marketing-webhooks/*`. Telegram's secret-token check reads a header only
 * and is unaffected by this, so it works either way.
 *
 * NO-THROW: a malformed payload is acked with 200 (logged), never 500 — a 500
 * makes Meta disable the webhook subscription.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  authorizeInboundWebhook,
  getMessagingProvider,
  ingestInbound,
} from "../../../modules/marketing/messaging"
import type { WebhookContext } from "../../../modules/marketing/messaging"

/** Resolve the exact signed bytes: prefer `req.rawBody`, else re-serialize. */
const resolveRawBody = (req: MedusaRequest): string => {
  const raw = (req as any).rawBody
  if (raw != null) {
    return Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw)
  }
  try {
    return JSON.stringify(req.body ?? {})
  } catch {
    return ""
  }
}

const buildContext = (req: MedusaRequest): WebhookContext => ({
  headers: req.headers as Record<string, string | string[] | undefined>,
  rawBody: resolveRawBody(req),
  body: req.body ?? null,
  query: (req.query ?? {}) as Record<string, any>,
})

/**
 * GET — Meta verification handshake. When the provider's `verifyChallenge`
 * returns the challenge string (verify token matched), echo it raw with 200;
 * otherwise 403.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const provider = getMessagingProvider(req.params.channel)
  if (!provider) {
    res.status(403).send("")
    return
  }

  const challenge = provider.verifyChallenge(buildContext(req))
  if (typeof challenge === "string") {
    res.status(200).send(challenge)
    return
  }

  res.status(403).send("")
}

/**
 * POST — inbound receiver. Verify the signature FAST (401 on failure), then
 * normalize + ingest. Always ack 200 on success, even for an empty batch, and
 * even if parsing/ingest throws (logged) — providers must be acked.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const provider = getMessagingProvider(req.params.channel)
  if (!provider) {
    res.status(404).send("")
    return
  }

  const ctx = buildContext(req)

  // In-handler authenticity gate — the ONLY thing standing between the open
  // perimeter and ingest. Return fast on failure; never reveal why.
  //
  // `authorizeInboundWebhook` runs the provider's own check AND, for
  // secret-token channels (Telegram), the authoritative DB-backed, timing-safe
  // match of the per-bot secret to its owning tenant. A token that matches no
  // connected bot is REJECTED here (401) instead of being acked and dropped
  // downstream. Signature channels (Meta HMAC) return `undefined` — proven, with
  // per-message attribution still to come inside `ingestInbound`.
  const authorized = await authorizeInboundWebhook(
    req.scope,
    provider,
    ctx
  ).catch(() => null)
  if (authorized === null) {
    res.status(401).send("")
    return
  }

  try {
    const msgs = provider.parseInbound(ctx)
    if (msgs?.length) {
      await ingestInbound(req.scope, msgs)
    }
  } catch (e: any) {
    // NO-THROW: log and still ack so the provider doesn't retry/disable.
    // eslint-disable-next-line no-console
    console.error(
      `[marketing-webhooks] parse/ingest failed for channel=${req.params.channel}:`,
      e?.message ?? e
    )
  }

  res.status(200).json({ received: true })
}
