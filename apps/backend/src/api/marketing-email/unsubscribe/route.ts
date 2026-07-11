import { resolveTenantId } from "../../../lib/tenant-context"
/**
 * Unsubscribe endpoint — `GET|POST /marketing-email/unsubscribe?u=<unsubToken>`
 * (first-party, on the store domain). `u` is an HMAC-signed token carrying the
 * contact id + email; `verifyUnsubscribe` authenticates + decodes it.
 *
 *   - POST is the RFC-8058 one-click List-Unsubscribe target the mailbox
 *     provider POSTs automatically: suppress, then respond 200 JSON quickly.
 *   - GET is the human clicking the footer link: suppress, then render a clean,
 *     self-contained (inline-styled, no external assets) branded confirmation.
 *
 * A bad/tampered/missing token NEVER errors or leaks: POST → 200 { ok:false },
 * GET → a friendly "invalid link" page (200). Suppression runs through the
 * no-throw `suppress` helper, so this route never 500s.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { verifyUnsubscribe } from "../../../modules/marketing/email/tokens"
import { suppress } from "../../../modules/marketing/email/suppression-service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const page = (title: string, heading: string, body: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
<div style="max-width:520px;margin:0 auto;padding:56px 24px;">
<div style="background:#ffffff;border:1px solid #e7e5e0;border-radius:14px;padding:40px 32px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
<div style="font-size:20px;font-weight:700;letter-spacing:0.02em;color:#111;margin-bottom:24px;">Forever&nbsp;Finds</div>
<h1 style="font-size:22px;line-height:1.3;margin:0 0 12px;font-weight:600;">${heading}</h1>
<p style="font-size:15px;line-height:1.6;color:#555;margin:0;">${body}</p>
</div>
<p style="font-size:12px;color:#9a968e;text-align:center;margin:24px 0 0;">&copy; Forever Finds</p>
</div>
</body>
</html>`

const sendHtml = (res: MedusaResponse, html: string): void => {
  res.setHeader("Content-Type", "text/html; charset=utf-8")
  res.setHeader("Cache-Control", "no-store")
  res.status(200).send(html)
}

const invalidPage = (): string =>
  page(
    "Unsubscribe link invalid",
    "This link isn&rsquo;t valid",
    "The unsubscribe link is invalid or has expired. If you keep receiving emails you didn&rsquo;t sign up for, please contact us and we&rsquo;ll take care of it."
  )

const confirmedPage = (): string =>
  page(
    "You&rsquo;re unsubscribed",
    "You&rsquo;ve been unsubscribed",
    "You&rsquo;ve been unsubscribed from Forever Finds emails. Changed your mind? Contact us and we&rsquo;ll add you right back."
  )

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const u = req.query?.u as string | undefined
  const verified = verifyUnsubscribe(u)

  if (!verified) {
    res.setHeader("Cache-Control", "no-store")
    res.status(200).json({ ok: false })
    return
  }

  // suppress() is no-throw and idempotent.
  await suppress(req.scope, {
    tenantId: TENANT_ID,
    email: verified.email,
    reason: "unsubscribe",
    source: "one-click",
  })

  res.setHeader("Cache-Control", "no-store")
  res.status(200).json({ ok: true })
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const u = req.query?.u as string | undefined
  const verified = verifyUnsubscribe(u)

  if (!verified) {
    sendHtml(res, invalidPage())
    return
  }

  await suppress(req.scope, {
    tenantId: TENANT_ID,
    email: verified.email,
    reason: "unsubscribe",
    source: "one-click",
  })

  sendHtml(res, confirmedPage())
}
