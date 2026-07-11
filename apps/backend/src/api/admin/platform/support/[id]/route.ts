import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../../modules/platform"

/** PUT /admin/platform/support/:id  { status } — open/close a ticket. */
export const PUT = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const status = String((req.body as { status?: string })?.status ?? "").trim()
  if (!["open", "closed"].includes(status)) return res.status(400).json({ message: "status must be open|closed" })
  const t = await svc.retrieveSupportTicket(req.params.id).catch(() => null)
  if (!t) return res.status(404).json({ message: "ticket not found" })
  await svc.updateSupportTickets({ id: req.params.id, status })
  res.json({ id: req.params.id, status })
}

/** DELETE /admin/platform/support/:id — remove a ticket. */
export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  await svc.deleteSupportTickets(req.params.id)
  res.json({ id: req.params.id, deleted: true })
}
