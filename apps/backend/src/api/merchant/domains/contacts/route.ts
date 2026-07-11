import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../_helpers"
import { DOMAINS_MODULE } from "../../../../modules/domains"

/**
 * Registrant contact (profile) routes for the authenticated merchant.
 *
 * A registrant profile is the SHARED BLOCKER for buying / transferring domains:
 * the registrar (ResellerClub) requires registrant name/email/phone/address to
 * create the customer + contact. `resolveContact` in the domain-service loads
 * the tenant default (or first) profile; without one, buy / transfer fail.
 *
 * Everything is scoped to ctx.tenant.id, so a merchant can only ever see or
 * create profiles under their own tenant.
 */

/** GET /merchant/domains/contacts — the merchant's registrant profiles. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  try {
    const service: any = req.scope.resolve(DOMAINS_MODULE)
    const limit = Number((req.query as any).limit ?? 50)
    const offset = Number((req.query as any).offset ?? 0)

    const [contacts, count] = await service.listAndCountDomainContacts(
      { tenant_id: ctx.tenant.id },
      { take: limit, skip: offset, order: { created_at: "DESC" } }
    )

    res.json({ contacts, count })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to list contacts" })
  }
}

/**
 * POST /merchant/domains/contacts — create a registrant profile.
 *
 * Accepts: name, email (required); phone, phone_country_code, company,
 * address_line1 (or `address`), address_line2, city, state, postal_code
 * (or `zip`), country (ISO-2), is_default. When is_default is set, the previous
 * default for this tenant is unset first.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const body = (req.body ?? {}) as any

  if (!body.name || typeof body.name !== "string") {
    return res.status(400).json({ message: "name is required" })
  }
  if (!body.email || typeof body.email !== "string") {
    return res.status(400).json({ message: "email is required" })
  }

  try {
    const service: any = req.scope.resolve(DOMAINS_MODULE)

    if (body.is_default) {
      await service.updateDomainContacts({
        selector: { tenant_id: ctx.tenant.id, is_default: true },
        data: { is_default: false },
      })
    }

    const contact = await service.createDomainContacts({
      tenant_id: ctx.tenant.id,
      name: body.name,
      email: body.email,
      phone: body.phone,
      phone_country_code: body.phone_country_code,
      company: body.company,
      address_line1: body.address_line1 ?? body.address,
      address_line2: body.address_line2,
      city: body.city,
      state: body.state,
      postal_code: body.postal_code ?? body.zip,
      country: body.country,
      is_default: !!body.is_default,
    } as any)

    res.status(201).json({ contact })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to create contact" })
  }
}
