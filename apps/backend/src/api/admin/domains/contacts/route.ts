import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { DOMAINS_MODULE } from "../../../../modules/domains"
import { TENANT_ID } from "../_utils"

/**
 * GET /admin/domains/contacts
 *
 * List registrant/contact profiles for the default tenant.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const service: any = req.scope.resolve(DOMAINS_MODULE)

    const limit = Number(req.query.limit ?? 50)
    const offset = Number(req.query.offset ?? 0)

    const [contacts, count] = await service.listAndCountDomainContacts(
      { tenant_id: TENANT_ID },
      { take: limit, skip: offset, order: { created_at: "DESC" } }
    )

    res.json({ contacts, count })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to list contacts" })
  }
}

/**
 * POST /admin/domains/contacts
 *
 * Create a registrant profile. When `is_default` is set, the previous default
 * for the tenant is unset first.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const body = (req.body ?? {}) as any

    if (!body.name || typeof body.name !== "string") {
      return res.status(400).json({ message: "name is required" })
    }
    if (!body.email || typeof body.email !== "string") {
      return res.status(400).json({ message: "email is required" })
    }

    const service: any = req.scope.resolve(DOMAINS_MODULE)

    if (body.is_default) {
      await service.updateDomainContacts({
        selector: { tenant_id: TENANT_ID, is_default: true },
        data: { is_default: false },
      })
    }

    const contact = await service.createDomainContacts({
      tenant_id: TENANT_ID,
      name: body.name,
      email: body.email,
      phone: body.phone,
      phone_country_code: body.phone_country_code,
      company: body.company,
      address_line1: body.address_line1,
      city: body.city,
      state: body.state,
      country: body.country,
      postal_code: body.postal_code,
      is_default: !!body.is_default,
    } as any)

    res.status(201).json({ contact })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to create contact" })
  }
}
