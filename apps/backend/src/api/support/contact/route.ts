import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../modules/platform"

/** POST /support/contact — PUBLIC marketing contact form → creates an open ticket. */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const b = (req.body ?? {}) as any
  const message = String(b.message ?? "").trim()
  if (!message) return res.status(400).json({ message: "message required" })
  const email = String(b.email ?? "").trim()
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ message: "invalid email" })
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  await svc.createSupportTickets([{
    name: String(b.name ?? "").slice(0, 120) || null,
    email: email.slice(0, 160) || null,
    subject: String(b.subject ?? "Contact form").slice(0, 200),
    message: message.slice(0, 5000),
    source: "contact", status: "open",
  }])
  res.status(201).json({ received: true })
}
