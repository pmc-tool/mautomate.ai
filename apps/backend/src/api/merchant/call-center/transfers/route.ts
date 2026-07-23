import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import { resolveMerchant } from "../../_helpers"

/**
 * GET /merchant/call-center/transfers?status=ringing
 *
 * The dashboard's incoming-call feed. STRICTLY tenant-scoped. Ringing rows
 * older than 2 minutes are treated as stale (the runtime's hold timeout has
 * long passed) and are excluded, so a browser that was closed mid-ring never
 * shows a ghost call.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const status = String((req.query as any)?.status ?? "ringing")
  try {
    const cc: any = req.scope.resolve(CALL_CENTER_MODULE)
    const rows = await cc.listTransfers(
      { tenant_id: ctx.merchant.tenant_id, status },
      { take: 20, order: { created_at: "DESC" } }
    )
    const fresh =
      status === "ringing"
        ? (rows ?? []).filter(
            (t: any) =>
              Date.now() - new Date(t.created_at).getTime() < 2 * 60 * 1000
          )
        : rows ?? []
    res.json({ transfers: fresh })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to list transfers" })
  }
}
