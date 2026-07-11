import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CONTACT_MODULE } from "../../../modules/contact"
import ContactModuleService from "../../../modules/contact/service"
import { storeTenant } from "../_tenant"

type ContactBody = {
  name?: string
  email?: string
  message?: string
}

export const POST = async (
  req: MedusaRequest<ContactBody>,
  res: MedusaResponse
) => {
  const { name, email, message } = req.body ?? {}

  if (!name || !email || !message) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Name, email and message are all required."
    )
  }

  // Attribute the submission to the owning store (fail closed): resolve the
  // tenant from the request's publishable key. A submission we cannot attribute
  // is REJECTED rather than written as an unscoped, cross-tenant-visible row.
  const tenant = await storeTenant(req)
  if (!tenant) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Could not resolve the store for this request."
    )
  }

  const contactModuleService: ContactModuleService =
    req.scope.resolve(CONTACT_MODULE)

  const created = await contactModuleService.createContactMessages({
    tenant_id: tenant.id,
    name,
    email,
    message,
  })

  res.status(201).json({ contact_message: created })
}
