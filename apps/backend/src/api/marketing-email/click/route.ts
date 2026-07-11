import { resolveTenantId } from "../../../lib/tenant-context"
/**
 * Click-tracking redirector — `GET /marketing-email/click?c=<clickToken>`
 * (first-party, on the store domain). `c` is an HMAC-signed token carrying the
 * real destination `url` + the originating `sendToken`; `verifyClickUrl` both
 * authenticates it (blocking open-redirect abuse — only URLs we signed pass) and
 * decodes it.
 *
 * The redirect ALWAYS happens — that is the recipient's actual click:
 *   - invalid/tampered/missing token → 302 to the store home (never leak, never
 *     error), so a mangled link still lands somewhere sensible.
 *   - valid token → best-effort record the click (bump count, stamp
 *     `clicked_at`, status "clicked"), then 302 to the decoded destination even
 *     if that DB write failed.
 * This route never 500s.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../modules/marketing"
import type MarketingModuleService from "../../../modules/marketing/service"
import { verifyClickUrl } from "../../../modules/marketing/email/tokens"
import { applyScore } from "../../../modules/marketing/scoring/scoring-service"
import { resolveStoreUrl } from "../../../modules/marketing/brand"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const c = req.query?.c as string | undefined
  const verified = verifyClickUrl(c)

  if (!verified) {
    res.redirect(302, await resolveStoreUrl(req.scope, TENANT_ID))
    return
  }

  // Best-effort click accounting — must not block or break the redirect.
  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    const rows = await svc.listMarketingEmailSends({
      token: verified.sendToken,
    } as any)
    const send = Array.isArray(rows) ? rows[0] : undefined
    if (send) {
      await svc.updateMarketingEmailSends({
        id: send.id,
        click_count: (send.click_count ?? 0) + 1,
        clicked_at: new Date(),
        status: "clicked",
      } as any)

      // Best-effort engagement scoring — must not affect the redirect.
      if (send.contact_id) {
        try {
          await applyScore(req.scope, {
            tenantId: TENANT_ID,
            contactId: send.contact_id,
            event: "email_click",
          })
        } catch {
          // Scoring is best-effort — swallow and still redirect.
        }
      }
    }
  } catch {
    // swallow — the recipient's click still redirects.
  }

  res.redirect(302, verified.url)
}
