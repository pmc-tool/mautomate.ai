import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createCustomerAddressesWorkflow } from "@medusajs/core-flows"
import { resolveMerchant } from "../../../_helpers"
import { customerBelongsToTenant, cleanStr } from "../../../_customer-helpers"

/**
 * POST /merchant/customers/:id/addresses
 *
 * Create an address for a tenant-owned customer.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { id } = req.params

  if (!(await customerBelongsToTenant(req, ctx, id))) {
    return res.status(404).json({ message: "customer not found" })
  }

  const body = (req.body || {}) as any
  if (!body?.address_1 || !String(body.address_1).trim()) {
    return res.status(400).json({ message: "address_1 is required" })
  }
  if (!body?.country_code || String(body.country_code).length !== 2) {
    return res.status(400).json({ message: "a 2-letter country_code is required" })
  }

  const address = {
    customer_id: id,
    address_name: cleanStr(body.address_name),
    first_name: cleanStr(body.first_name),
    last_name: cleanStr(body.last_name),
    company: cleanStr(body.company),
    address_1: String(body.address_1).trim(),
    address_2: cleanStr(body.address_2),
    city: cleanStr(body.city),
    province: cleanStr(body.province),
    postal_code: cleanStr(body.postal_code),
    country_code: String(body.country_code).toLowerCase(),
    phone: cleanStr(body.phone),
    is_default_shipping: !!body.is_default_shipping,
    is_default_billing: !!body.is_default_billing,
  }

  try {
    const { result } = await createCustomerAddressesWorkflow(req.scope).run({
      input: { addresses: [address] as any },
    })
    const created = Array.isArray(result) ? result[0] : result
    return res.status(201).json({ address: created })
  } catch (e: any) {
    return res
      .status(400)
      .json({ message: e?.message || "failed to create address" })
  }
}
