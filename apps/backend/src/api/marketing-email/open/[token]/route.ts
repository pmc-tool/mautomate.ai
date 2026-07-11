import { resolveTenantId } from "../../../../lib/tenant-context"
/**
 * Open-tracking pixel — `GET /marketing-email/open/:token` (first-party, on the
 * store domain). `:token` is the per-send `marketing_email_send.token` embedded
 * as a 1x1 `<img>` in the email body; the recipient's client fetching it records
 * the open.
 *
 * ALWAYS returns the transparent GIF with 200 + `no-store`, no matter what:
 * unknown token, DB error, anything. Tracking is strictly best-effort — a
 * failure here must never 500 and must never leak whether the token exists (the
 * pixel is identical in every case). On the first open we stamp `opened_at` +
 * bump status to "opened", but never downgrade a send already "clicked".
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"
import { applyScore } from "../../../../modules/marketing/scoring/scoring-service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

// 1x1 transparent GIF.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
)

const sendPixel = (res: MedusaResponse): void => {
  res.setHeader("Content-Type", "image/gif")
  res.setHeader("Cache-Control", "no-store")
  res.status(200).send(PIXEL)
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const token = req.params?.token
    if (token) {
      const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
      const rows = await svc.listMarketingEmailSends({ token } as any)
      const send = Array.isArray(rows) ? rows[0] : undefined

      if (send) {
        const isFirstOpen = !send.opened_at
        const update: Record<string, any> = {
          id: send.id,
          open_count: (send.open_count ?? 0) + 1,
        }
        if (isFirstOpen) {
          update.opened_at = new Date()
          // Never downgrade a send already progressed to "clicked".
          if (send.status !== "clicked") {
            update.status = "opened"
          }
        }
        await svc.updateMarketingEmailSends(update as any)

        // Best-effort engagement scoring — must not affect the pixel response.
        if (send.contact_id) {
          try {
            await applyScore(req.scope, {
              tenantId: TENANT_ID,
              contactId: send.contact_id,
              event: "email_open",
            })
          } catch {
            // Scoring is best-effort — swallow and still return the pixel.
          }
        }
      }
    }
  } catch {
    // Tracking is best-effort — swallow everything and still return the pixel.
  }

  sendPixel(res)
}
