import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import * as fs from "fs"
import * as path from "path"
import { resolveMerchant } from "../../../_helpers"
import { CALL_CENTER_MODULE } from "../../../../../modules/call-center"

const RECORDINGS_DIR =
  process.env.CALL_RECORDINGS_DIR || "/home/ratul/call-recordings"

/**
 * GET /merchant/call-center/calls/:id
 *
 * Full detail for one call: the call record (transcript, summary, sentiment,
 * disposition, recording, timings, cost), the dispositions logged during it, the
 * driving agent's name, and the linked order's number. Tenant-scoped: a call
 * that belongs to another tenant returns 404.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenant_id = ctx.merchant.tenant_id
  if (!tenant_id) {
    return res.status(401).json({ message: "merchant tenant not resolved" })
  }

  const { id } = req.params
  const cc: any = req.scope.resolve(CALL_CENTER_MODULE)

  let call: any = null
  try {
    call = await cc.retrieveCall(id)
  } catch {
    call = null
  }
  if (!call || call.tenant_id !== tenant_id) {
    return res.status(404).json({ message: "call not found" })
  }

  // Dispositions logged for this call (oldest first).
  const dispositions = await cc
    .listDispositions({ call_id: id, tenant_id }, { order: { created_at: "ASC" } })
    .catch(() => [])

  // Driving agent (playbook) name.
  let agent: { id: string; name: string } | null = null
  if (call.playbook_id) {
    const pb = await cc.retrievePlaybook(call.playbook_id).catch(() => null)
    if (pb && pb.tenant_id === tenant_id) {
      agent = { id: pb.id, name: pb.name }
    }
  }

  // Linked order number (scoped to this tenant's sales channel).
  let order: { id: string; display_id: number } | null = null
  if (call.order_id) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const scId = ctx.tenant.meta?.sales_channel_id
    const { data } = await query
      .graph({
        entity: "order",
        filters: {
          id: call.order_id,
          ...(scId ? { sales_channel_id: scId } : {}),
        } as any,
        fields: ["id", "display_id"],
        pagination: { take: 1, skip: 0 } as any,
      })
      .catch(() => ({ data: [] as any[] }))
    const o = (data || [])[0]
    if (o) order = { id: o.id, display_id: o.display_id }
  }

  // Does a locally-stored WAV recording exist for this call?
  const safe = String(id).replace(/[^a-zA-Z0-9_]/g, "")
  const has_recording =
    !!safe && fs.existsSync(path.join(RECORDINGS_DIR, `${safe}.wav`))

  res.json({ call, dispositions, agent, order, has_recording })
}
