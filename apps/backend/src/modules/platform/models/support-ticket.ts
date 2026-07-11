import { model } from "@medusajs/framework/utils"
/** support_ticket — a merchant support request or a marketing contact-form lead. */
const SupportTicket = model.define("support_ticket", {
  id: model.id({ prefix: "tkt" }).primaryKey(),
  name: model.text().nullable(),
  email: model.text().nullable(),
  subject: model.text().nullable(),
  message: model.text(),
  tenant_id: model.text().nullable(),
  source: model.enum(["contact", "support"]).default("contact"),
  status: model.enum(["open", "closed"]).default("open"),
}).indexes([{ name: "IDX_ticket_status", on: ["status"], unique: false, where: "deleted_at IS NULL" }])
export default SupportTicket
