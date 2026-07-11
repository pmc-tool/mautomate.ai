import { model } from "@medusajs/framework/utils"

const ContactMessage = model.define("contact_message", {
  id: model.id().primaryKey(),
  tenant_id: model.text().nullable(),
  name: model.text(),
  email: model.text(),
  message: model.text(),
})

export default ContactMessage
