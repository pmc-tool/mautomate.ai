import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONTACT_MODULE } from "../../../modules/contact"
import ContactModuleService from "../../../modules/contact/service"
import { resolveMerchant } from "../_helpers"

/**
 * Contact-form submissions for THIS merchant's store. Rows are written
 * tenant-stamped by POST /store/contact (fail-closed), so filtering on the
 * caller's tenant id is the complete isolation story — rows without a
 * tenant_id are never returned.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const take = Math.min(Number(req.query.limit) || 50, 200)
  const skip = Math.max(Number(req.query.offset) || 0, 0)

  const contactModule: ContactModuleService = req.scope.resolve(CONTACT_MODULE)
  const [messages, count] = await contactModule.listAndCountContactMessages(
    { tenant_id: ctx.tenant.id },
    { take, skip, order: { created_at: "DESC" } }
  )

  res.json({ messages, count, limit: take, offset: skip })
}
