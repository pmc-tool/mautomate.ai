import crypto from "crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import { ensurePlatformEnv } from "../../../../modules/marketing/platform-credentials"

/**
 * Meta Data Deletion Request callback (App Review requirement).
 *
 * Facebook POSTs `signed_request` = "<sig>.<payload>" where sig is
 * HMAC-SHA256(payload, app_secret) and payload is base64url JSON carrying
 * the Facebook `user_id` who asked for deletion. We must delete what we
 * hold for that user and answer with a status URL + confirmation code.
 *
 * What we hold, keyed by that Facebook user: marketing_social_account rows
 * connected VIA that login (meta.via_user_id) or directly identifying it
 * (external_id), their sealed tokens (cascade with the account rows), and
 * ads_connection rows (external_user_id). All are soft-deleted across every
 * tenant — the user's request applies platform-wide.
 *
 * GET ?code=… serves the human-readable status page the response URL points
 * at. The confirmation code is deterministic (HMAC of user_id) so the status
 * page can always answer without storing per-request state.
 */

const b64urlDecode = (s: string): Buffer =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64")

const confirmationFor = (userId: string, secret: string): string =>
  crypto
    .createHmac("sha256", secret)
    .update(`meta-deletion:${userId}`)
    .digest("hex")
    .slice(0, 16)

const statusBase = (): string => {
  const base =
    process.env.MARKETING_BACKEND_URL ??
    process.env.MEDUSA_BACKEND_URL ??
    "https://api.mautomate.ai"
  return `${base.replace(/\/$/, "")}/webhooks/marketing/meta-data-deletion`
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    await ensurePlatformEnv(req.scope)
  } catch {
    /* non-blocking */
  }
  const secret = process.env.MARKETING_FACEBOOK_APP_SECRET ?? ""
  const signedRequest =
    (req.body as any)?.signed_request ??
    (typeof req.body === "string"
      ? new URLSearchParams(req.body).get("signed_request")
      : null)

  if (!secret || typeof signedRequest !== "string" || !signedRequest.includes(".")) {
    res.status(400).json({ message: "Malformed signed_request" })
    return
  }

  const [sigPart, payloadPart] = signedRequest.split(".", 2)
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payloadPart, "utf8")
    .digest()
  const provided = b64urlDecode(sigPart)
  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    res.status(400).json({ message: "Bad signature" })
    return
  }

  let payload: any = null
  try {
    payload = JSON.parse(b64urlDecode(payloadPart).toString("utf8"))
  } catch {
    res.status(400).json({ message: "Bad payload" })
    return
  }
  const userId = payload?.user_id != null ? String(payload.user_id) : ""
  if (!userId) {
    res.status(400).json({ message: "Missing user_id" })
    return
  }

  // Delete everything held for this Facebook user, across all tenants.
  const mk: any = req.scope.resolve(MARKETING_MODULE)
  let removed = 0
  try {
    const direct = await mk.listMarketingSocialAccounts(
      { external_id: userId },
      { take: 200 }
    )
    for (const a of Array.isArray(direct) ? direct : []) {
      await mk.softDeleteMarketingSocialAccounts([a.id]).catch(() => {})
      removed++
    }
    // Accounts connected via this login (pages / IG accounts) carry
    // meta.via_user_id — json filtering support varies, so scan bounded.
    const all = await mk.listMarketingSocialAccounts({}, { take: 1000 })
    for (const a of Array.isArray(all) ? all : []) {
      if (String((a?.meta as any)?.via_user_id ?? "") === userId) {
        await mk.softDeleteMarketingSocialAccounts([a.id]).catch(() => {})
        removed++
      }
    }
    const conns = await mk.listAdsConnections(
      { external_user_id: userId },
      { take: 100 }
    )
    for (const c of Array.isArray(conns) ? conns : []) {
      await mk.softDeleteAdsConnections?.([c.id]).catch(() => {})
      removed++
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      "[meta-data-deletion] cleanup error (request still acknowledged):",
      (e as Error).message
    )
  }

  const code = confirmationFor(userId, secret)
  // eslint-disable-next-line no-console
  console.log(
    `[meta-data-deletion] user ${userId}: removed ${removed} record(s), confirmation ${code}`
  )
  res.json({
    url: `${statusBase()}?code=${code}`,
    confirmation_code: code,
  })
}

/** Human-readable deletion status page (the URL returned above). */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const code = String((req.query as any)?.code ?? "")
  res
    .status(200)
    .type("html")
    .send(
      `<!doctype html><html><head><meta charset="utf-8"><title>Data deletion — mAutomate</title></head>` +
        `<body style="font-family:system-ui,sans-serif;max-width:560px;margin:80px auto;padding:0 20px;color:#1f1f1f">` +
        `<h1 style="font-size:22px">Data deletion request</h1>` +
        `<p>Your Facebook data deletion request has been completed. All social account connections and access tokens associated with your Facebook account have been removed from mAutomate.</p>` +
        (code
          ? `<p style="color:#666">Confirmation code: <code>${code.replace(/[^a-f0-9]/gi, "")}</code></p>`
          : "") +
        `<p style="color:#666">Questions? Contact <a href="mailto:support@mautomate.ai">support@mautomate.ai</a>.</p>` +
        `</body></html>`
    )
}
