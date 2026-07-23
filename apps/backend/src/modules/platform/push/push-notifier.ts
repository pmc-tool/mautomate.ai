import crypto from "crypto"

import { PLATFORM_MODULE } from "../index"

/**
 * Push notifier — fans an attention signal out to a merchant's mobile devices
 * via Firebase Cloud Messaging (FCM HTTP v1).
 *
 * ============================ INERT BY DEFAULT ============================
 * This is SAFE TO SHIP DORMANT. It sends NOTHING and touches no network unless
 * BOTH are true:
 *   1. env PUSH_ENABLED === "1"                         (the kill switch)
 *   2. the FCM service-account creds are present:
 *        FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY
 *
 * When either is missing it logs at debug level and returns a no-op result. It
 * NEVER throws to its caller — a failed push must never fail an order, an event
 * handler, or a request. Activation is purely operational: drop the three env
 * vars in (from the Firebase project's service-account JSON) and flip
 * PUSH_ENABLED=1. No code change, no redeploy of logic.
 * =========================================================================
 *
 * Auth: we mint a short-lived OAuth2 access token from the service account with
 * a self-signed RS256 JWT (Node's built-in crypto — no extra dependency), cache
 * it in-process until just before expiry, and send messages with it. Tokens
 * FCM reports as unregistered/invalid are pruned (soft-deleted) so we stop
 * pushing to dead installs.
 */

/** A structural view of the container — avoids a hard type import. */
type Container = { resolve: <T = any>(key: string) => T }

/** The user-facing content of a push, plus deep-link routing hints. */
export type PushNotification = {
  title: string
  body: string
  /**
   * Extra key/value data delivered silently alongside the notification. The
   * app reads `data.route` (a go_router path like "/orders") to deep-link on
   * tap; `data.type` names the attention signal. All values MUST be strings —
   * FCM only carries string data.
   */
  data?: Record<string, string>
}

export type PushResult = {
  /** How many device messages FCM accepted. */
  sent: number
  /** How many dead tokens were pruned. */
  pruned: number
  /** Set when the notifier short-circuited (disabled / no creds / no devices). */
  skipped?: string
}

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"

type Creds = {
  projectId: string
  clientEmail: string
  privateKey: string
}

/** Read + validate the FCM service-account creds from the environment. */
function readCreds(): Creds | null {
  const projectId = process.env.FCM_PROJECT_ID
  const clientEmail = process.env.FCM_CLIENT_EMAIL
  // Env-stored PEM keys usually carry literal "\n" — restore real newlines.
  const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n")
  if (!projectId || !clientEmail || !privateKey) {
    return null
  }
  return { projectId, clientEmail, privateKey }
}

/** True only when the master switch is on AND creds are present. */
export function isPushEnabled(): boolean {
  return process.env.PUSH_ENABLED === "1" && readCreds() !== null
}

// ---- OAuth2 access-token minting (cached in-process) ----------------------

let cachedToken: { value: string; expiresAt: number } | null = null

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url")
}

/** Sign a service-account JWT and exchange it for an OAuth2 access token. */
async function getAccessToken(creds: Creds): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  // Reuse a still-valid token (60s safety margin).
  if (cachedToken && cachedToken.expiresAt - 60 > now) {
    return cachedToken.value
  }

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claim = base64url(
    JSON.stringify({
      iss: creds.clientEmail,
      scope: FCM_SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    })
  )
  const unsigned = `${header}.${claim}`
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsigned)
    .sign(creds.privateKey, "base64url")
  const assertion = `${unsigned}.${signature}`

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`FCM token exchange failed (${res.status}): ${detail}`)
  }

  const json = (await res.json()) as {
    access_token?: string
    expires_in?: number
  }
  if (!json.access_token) {
    throw new Error("FCM token exchange returned no access_token")
  }

  cachedToken = {
    value: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600),
  }
  return cachedToken.value
}

// ---- Sending --------------------------------------------------------------

/** True when FCM's error means the token is dead and should be pruned. */
function isDeadToken(status: number, body: string): boolean {
  if (status === 404) {
    return true
  }
  return (
    /UNREGISTERED/.test(body) ||
    /registration-token-not-registered/.test(body) ||
    (status === 400 && /INVALID_ARGUMENT/.test(body))
  )
}

/**
 * Send a push to a merchant's devices.
 *
 * @param container Medusa container (resolves the platform module + logger).
 * @param args.tenantId    REQUIRED — the tenant whose devices to notify.
 * @param args.merchantId  OPTIONAL — restrict to one merchant user's devices;
 *                         omitted = every device in the tenant.
 *
 * Returns a summary; NEVER throws. Both the tenant and (optional) merchant are
 * caller-supplied from a trusted server context (a subscriber that resolved the
 * owning tenant, or a request handler that already ran resolveMerchant) — this
 * function does not accept anything from an untrusted client.
 */
export async function sendMerchantPush(
  container: Container,
  args: {
    tenantId: string
    merchantId?: string
    notification: PushNotification
  }
): Promise<PushResult> {
  const logger: any = safeLogger(container)

  if (process.env.PUSH_ENABLED !== "1") {
    logger?.debug?.("[push] disabled (PUSH_ENABLED != 1) — no-op")
    return { sent: 0, pruned: 0, skipped: "disabled" }
  }

  const creds = readCreds()
  if (!creds) {
    logger?.warn?.(
      "[push] PUSH_ENABLED=1 but FCM creds missing (FCM_PROJECT_ID / FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY) — no-op"
    )
    return { sent: 0, pruned: 0, skipped: "no-creds" }
  }

  try {
    const svc: any = container.resolve(PLATFORM_MODULE)

    const filters: Record<string, unknown> = { tenant_id: args.tenantId }
    if (args.merchantId) {
      filters.merchant_id = args.merchantId
    }
    const devices: any[] = await svc
      .listMerchantDevices(filters, { take: 500 })
      .catch(() => [])

    if (!devices.length) {
      return { sent: 0, pruned: 0, skipped: "no-devices" }
    }

    const accessToken = await getAccessToken(creds)
    const url = `https://fcm.googleapis.com/v1/projects/${creds.projectId}/messages:send`

    let sent = 0
    const deadIds: string[] = []

    for (const device of devices) {
      const message = {
        message: {
          token: device.token,
          notification: {
            title: args.notification.title,
            body: args.notification.body,
          },
          data: args.notification.data ?? {},
          android: { priority: "high" as const },
          apns: {
            headers: { "apns-priority": "10" },
            payload: { aps: { sound: "default" } },
          },
        },
      }

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(message),
        })

        if (res.ok) {
          sent++
          continue
        }

        const body = await res.text().catch(() => "")
        if (isDeadToken(res.status, body)) {
          deadIds.push(device.id)
        } else {
          logger?.warn?.(
            `[push] send failed for device ${device.id} (${res.status}): ${body}`
          )
        }
      } catch (e: any) {
        logger?.warn?.(
          `[push] send threw for device ${device.id}: ${e?.message ?? e}`
        )
      }
    }

    // Prune dead tokens so we stop pushing to uninstalled apps.
    if (deadIds.length) {
      await svc.softDeleteMerchantDevices(deadIds).catch(() => {})
    }

    return { sent, pruned: deadIds.length }
  } catch (e: any) {
    // Absolute backstop — the notifier must never throw to its caller.
    logger?.error?.(`[push] notifier error (swallowed): ${e?.message ?? e}`)
    return { sent: 0, pruned: 0, skipped: "error" }
  }
}

function safeLogger(container: Container): any {
  try {
    return container.resolve("logger")
  } catch {
    return null
  }
}

// ---- Typed convenience wrappers (one per Home attention signal) -----------
//
// These name the four signals the app's Home surfaces so the call sites read
// cleanly and the deep-link route + data shape stay consistent. Each is a thin
// call to sendMerchantPush and inherits its gating + no-throw guarantee.

/** New order placed. Deep-links to Orders. */
export function notifyNewOrder(
  container: Container,
  tenantId: string,
  opts: { orderDisplay?: string; total?: string } = {}
): Promise<PushResult> {
  const label = opts.orderDisplay ? `Order ${opts.orderDisplay}` : "New order"
  return sendMerchantPush(container, {
    tenantId,
    notification: {
      title: "New order",
      body: opts.total ? `${label} — ${opts.total}` : `${label} just came in.`,
      data: { type: "new_order", route: "/orders" },
    },
  })
}

/** A conversation was handed from the AI to a human. Deep-links to inbox. */
export function notifyInboxNeedsYou(
  container: Container,
  tenantId: string,
  merchantId?: string
): Promise<PushResult> {
  return sendMerchantPush(container, {
    tenantId,
    merchantId,
    notification: {
      title: "A customer needs you",
      body: "The AI handed a conversation to a human. A reply is waiting.",
      // Inbox lives under Jarvis/messaging in the app today; route to /jarvis
      // until a dedicated /inbox route exists.
      data: { type: "inbox_needs_you", route: "/jarvis" },
    },
  })
}

/** A product crossed the low-stock threshold. Deep-links to Products. */
export function notifyLowStock(
  container: Container,
  tenantId: string,
  opts: { productTitle?: string; available?: number } = {}
): Promise<PushResult> {
  const title = opts.productTitle ?? "A product"
  const body =
    typeof opts.available === "number"
      ? `${title}: only ${opts.available} left. Restock before it sells out.`
      : `${title} is low on stock. Restock before it sells out.`
  return sendMerchantPush(container, {
    tenantId,
    notification: {
      title: "Low stock",
      body,
      data: { type: "low_stock", route: "/products" },
    },
  })
}

/** A Jarvis voice action is waiting for the merchant. Deep-links to Jarvis. */
export function notifyVoicePending(
  container: Container,
  tenantId: string,
  merchantId?: string
): Promise<PushResult> {
  return sendMerchantPush(container, {
    tenantId,
    merchantId,
    notification: {
      title: "Jarvis needs you",
      body: "A voice action is waiting for your confirmation.",
      data: { type: "voice_pending", route: "/jarvis" },
    },
  })
}
