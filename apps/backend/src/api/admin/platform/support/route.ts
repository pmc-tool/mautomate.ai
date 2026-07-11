import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../modules/platform"

/** GET /admin/platform/support — support/contact inbox (newest first). */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const status = req.query.status ? { status: String(req.query.status) } : {}
  const tickets = await svc.listSupportTickets(status, { order: { created_at: "DESC" }, take: 200 })
  const open = (await svc.listSupportTickets({ status: "open" }, { take: 1000 })).length
  res.json({ tickets: tickets || [], open })
}
