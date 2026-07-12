import { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MerchantCtx } from "./_helpers"

/**
 * A customer belongs to this tenant if EITHER:
 *  - it was created by this tenant (metadata.tenant_id === tenant.id), or
 *  - it has at least one order in this tenant's sales channel.
 *
 * This keeps the existing order-derived scoping (legacy shoppers) working while
 * making customers created through the merchant dashboard immediately visible.
 * Fail-closed: unknown customers return false.
 */
export async function customerBelongsToTenant(
  req: MedusaRequest,
  ctx: MerchantCtx,
  customerId: string
): Promise<boolean> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: customerData } = await query.graph({
    entity: "customer",
    filters: { id: customerId } as any,
    fields: ["id", "metadata"],
    pagination: { take: 1, skip: 0 } as any,
  })
  const customer: any = (customerData || [])[0]
  if (!customer) return false
  if (customer.metadata?.tenant_id === ctx.tenant.id) return true

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return false

  const { data: orders } = await query.graph({
    entity: "order",
    filters: { customer_id: customerId, sales_channel_id: scId } as any,
    fields: ["id"],
    pagination: { take: 1, skip: 0 } as any,
  })
  return (orders || []).length > 0
}

/**
 * Resolve a customer group only if it is tagged with this tenant's id. Other
 * tenants' — and legacy untagged — groups resolve to null (fail-closed).
 */
export async function findOwnedGroup(
  req: MedusaRequest,
  tenantId: string,
  id: string
): Promise<any | null> {
  const customerModule: any = req.scope.resolve(Modules.CUSTOMER)
  const group = await customerModule.retrieveCustomerGroup(id).catch(() => null)
  if (!group || group.metadata?.tenant_id !== tenantId) return null
  return group
}

export function cleanStr(v: any): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined
}
