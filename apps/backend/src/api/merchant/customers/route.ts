import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createCustomersWorkflow } from "@medusajs/core-flows"
import { resolveMerchant } from "../_helpers"
import { cleanStr } from "../_customer-helpers"

const CUSTOMER_FIELDS = [
  "id",
  "email",
  "first_name",
  "last_name",
  "company_name",
  "phone",
  "has_account",
  "created_at",
  "updated_at",
  "metadata",
]

// The internal per-source fetch ceiling; also the maximum page size a client
// may request. When no limit param is sent the FULL scoped list (up to this
// ceiling) is returned, matching the pre-rewrite behavior that deployed
// consumers (listCustomers(token) with no params) rely on.
const MAX_TAKE = 1000

/**
 * GET /merchant/customers
 *
 * Tenant-scoped customer list. A customer is tenant-visible when it was created
 * by this tenant (metadata.tenant_id) OR it placed an order in this tenant's
 * sales channel. Both sources are unioned; the result is fail-closed so no other
 * tenant's shoppers ever appear. Supports q/offset/limit and has_account filter.
 * Omitting limit returns the whole list (ceiling 1000) for back-compat.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const ownedIds = new Set<string>()

  // Customers explicitly created by this tenant.
  const { data: tagged } = await query.graph({
    entity: "customer",
    filters: { metadata: { tenant_id: ctx.tenant.id } } as any,
    fields: ["id", "metadata"],
    pagination: { take: MAX_TAKE, skip: 0 } as any,
  })
  for (const c of tagged || []) {
    if ((c as any).metadata?.tenant_id === ctx.tenant.id) ownedIds.add((c as any).id)
  }

  // Customers derived from order ownership in this tenant's sales channel.
  if (scId) {
    const { data: orders } = await query.graph({
      entity: "order",
      filters: { sales_channel_id: scId } as any,
      fields: ["customer_id"],
      pagination: { take: MAX_TAKE, skip: 0 } as any,
    })
    for (const o of orders || []) {
      if ((o as any).customer_id) ownedIds.add((o as any).customer_id)
    }
  }

  if (!ownedIds.size) return res.json({ customers: [], count: 0 })

  const { data } = await query.graph({
    entity: "customer",
    filters: { id: Array.from(ownedIds) } as any,
    fields: CUSTOMER_FIELDS,
    pagination: { take: MAX_TAKE, skip: 0, order: { created_at: "DESC" } } as any,
  })

  const q = ((req.query.q as string) || "").trim().toLowerCase()
  const hasAccountParam = req.query.has_account as string | undefined
  const offset = Math.max(0, parseInt((req.query.offset as string) || "0", 10) || 0)

  // No limit param -> full list (old behavior). Explicit limit -> clamp 1..1000.
  const limitParam = req.query.limit
  const limitRaw =
    typeof limitParam === "string" && limitParam !== ""
      ? parseInt(limitParam, 10)
      : NaN
  const limit = isNaN(limitRaw) ? MAX_TAKE : Math.min(MAX_TAKE, Math.max(1, limitRaw))

  let rows = (data || []).map((c: any) => ({
    id: c.id,
    email: c.email,
    first_name: c.first_name,
    last_name: c.last_name,
    company_name: c.company_name,
    phone: c.phone,
    has_account: !!c.has_account,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }))

  if (hasAccountParam === "true" || hasAccountParam === "false") {
    const want = hasAccountParam === "true"
    rows = rows.filter((c) => c.has_account === want)
  }

  if (q) {
    rows = rows.filter((c) => {
      const name = [c.first_name, c.last_name].filter(Boolean).join(" ").toLowerCase()
      return (
        (c.email || "").toLowerCase().includes(q) ||
        name.includes(q) ||
        (c.company_name || "").toLowerCase().includes(q)
      )
    })
  }

  const count = rows.length
  const paged = rows.slice(offset, offset + limit)

  res.json({ customers: paged, count })
}

/**
 * POST /merchant/customers
 *
 * Creates a (guest) customer and tags it with metadata.tenant_id so it is
 * immediately visible under this tenant's list scoping.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const body = (req.body || {}) as any
  const email = typeof body.email === "string" ? body.email.trim() : ""
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "a valid email is required" })
  }

  try {
    const { result } = await createCustomersWorkflow(req.scope).run({
      input: {
        customersData: [
          {
            email,
            first_name: cleanStr(body.first_name),
            last_name: cleanStr(body.last_name),
            company_name: cleanStr(body.company_name),
            phone: cleanStr(body.phone),
            metadata: { tenant_id: ctx.tenant.id },
          },
        ],
      },
    })
    const customer = (result as any[])[0]
    return res.status(201).json({ customer })
  } catch (e: any) {
    return res
      .status(400)
      .json({ message: e?.message || "failed to create customer" })
  }
}
