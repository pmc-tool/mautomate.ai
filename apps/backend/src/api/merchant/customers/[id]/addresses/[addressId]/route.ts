import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import {
  updateCustomerAddressesWorkflow,
  deleteCustomerAddressesWorkflow,
} from "@medusajs/core-flows"
import { resolveMerchant } from "../../../../_helpers"
import { customerBelongsToTenant, cleanStr } from "../../../../_customer-helpers"

async function assertOwnedAddress(
  req: MedusaRequest,
  customerId: string,
  addressId: string
): Promise<boolean> {
  const customerModule: any = req.scope.resolve(Modules.CUSTOMER)
  const found = await customerModule
    .listCustomerAddresses({ id: addressId }, { take: 1 })
    .catch(() => [])
  const addr = (found || [])[0]
  return !!addr && addr.customer_id === customerId
}

/**
 * POST /merchant/customers/:id/addresses/:addressId
 *
 * Update an address belonging to a tenant-owned customer.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { id, addressId } = req.params

  if (!(await customerBelongsToTenant(req, ctx, id))) {
    return res.status(404).json({ message: "customer not found" })
  }
  if (!(await assertOwnedAddress(req, id, addressId))) {
    return res.status(404).json({ message: "address not found" })
  }

  const body = (req.body || {}) as any
  const update: any = {}

  for (const k of [
    "address_name",
    "first_name",
    "last_name",
    "company",
    "address_1",
    "address_2",
    "city",
    "province",
    "postal_code",
    "phone",
  ]) {
    if (k in body) update[k] = cleanStr(body[k]) ?? null
  }
  if ("country_code" in body && body.country_code) {
    update.country_code = String(body.country_code).toLowerCase()
  }
  if ("is_default_shipping" in body) update.is_default_shipping = !!body.is_default_shipping
  if ("is_default_billing" in body) update.is_default_billing = !!body.is_default_billing

  try {
    const { result } = await updateCustomerAddressesWorkflow(req.scope).run({
      input: { selector: { id: addressId }, update },
    })
    const updated = Array.isArray(result) ? result[0] : result
    return res.json({ address: updated })
  } catch (e: any) {
    return res
      .status(400)
      .json({ message: e?.message || "failed to update address" })
  }
}

/**
 * DELETE /merchant/customers/:id/addresses/:addressId
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { id, addressId } = req.params

  if (!(await customerBelongsToTenant(req, ctx, id))) {
    return res.status(404).json({ message: "customer not found" })
  }
  if (!(await assertOwnedAddress(req, id, addressId))) {
    return res.status(404).json({ message: "address not found" })
  }

  await deleteCustomerAddressesWorkflow(req.scope).run({
    input: { ids: [addressId] },
  })

  res.json({ id: addressId, object: "customer_address", deleted: true })
}
