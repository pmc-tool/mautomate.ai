import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../../../../_helpers"
import {
  getCatalogTemplate,
  type CatalogToken,
} from "../../../../../../../modules/marketing/email/catalog"
import { resolveCatalogEmail } from "../../../../../../../modules/marketing/email/catalog-resolver"
import { sendEmail } from "../../../../../../../modules/marketing/email/send-service"

const sampleContext = (tokens: CatalogToken[]): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const t of tokens) out[t.token] = t.sample
  return out
}

/**
 * POST /merchant/marketing/email/notifications/:key/test
 * Body: { to? } — send a sample of this template to the merchant (or `to`).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { key } = req.params
  const tpl = getCatalogTemplate(key)
  if (!tpl) return res.status(404).json({ message: "unknown template" })

  const b = (req.body ?? {}) as Record<string, any>
  const to =
    (typeof b.to === "string" && b.to.trim()) || ctx.merchant?.email || ""
  if (!to) {
    return res.status(400).json({ message: "no destination email" })
  }

  try {
    const email = await resolveCatalogEmail(
      req.scope,
      ctx.tenant.id,
      key,
      sampleContext(tpl.tokens)
    )
    if (!email) return res.status(404).json({ message: "unknown template" })

    const result = await sendEmail(req.scope, {
      tenantId: ctx.tenant.id,
      to,
      subject: `[Test] ${email.subject}`,
      html: email.html,
    })

    if (!result.ok && !result.suppressed) {
      return res
        .status(502)
        .json({ ok: false, message: result.error ?? "send failed" })
    }
    res.json({ ok: true, to, suppressed: !!result.suppressed })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to send test" })
  }
}
