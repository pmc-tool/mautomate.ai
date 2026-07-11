import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { DOMAINS_MODULE } from "../../../../../modules/domains"
import { TENANT_ID } from "../../_utils"

const UPDATABLE_FIELDS = [
  "name",
  "email",
  "phone",
  "phone_country_code",
  "company",
  "address_line1",
  "city",
  "state",
  "country",
  "postal_code",
] as const

/**
 * GET /admin/domains/contacts/:id
 *
 * Retrieve a single registrant profile (tenant-scoped).
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const service: any = req.scope.resolve(DOMAINS_MODULE)
    const contact = await service
      .retrieveDomainContact(req.params.id)
      .catch(() => null)

    if (!contact || contact.tenant_id !== TENANT_ID) {
      return res.status(404).json({ message: "Contact was not found" })
    }

    res.json({ contact })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to load contact" })
  }
}

/**
 * POST /admin/domains/contacts/:id
 *
 * Update a registrant profile. When `is_default` is set true, other defaults
 * for the tenant are unset first.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const service: any = req.scope.resolve(DOMAINS_MODULE)
    const body = (req.body ?? {}) as any

    const existing = await service
      .retrieveDomainContact(req.params.id)
      .catch(() => null)
    if (!existing || existing.tenant_id !== TENANT_ID) {
      return res.status(404).json({ message: "Contact was not found" })
    }

    if (body.is_default) {
      await service.updateDomainContacts({
        selector: { tenant_id: TENANT_ID, is_default: true },
        data: { is_default: false },
      })
    }

    const update: any = { id: req.params.id }
    for (const key of UPDATABLE_FIELDS) {
      if (body[key] !== undefined) {
        update[key] = body[key]
      }
    }
    if (body.is_default !== undefined) {
      update.is_default = !!body.is_default
    }

    const contact = await service.updateDomainContacts(update)

    res.json({ contact: Array.isArray(contact) ? contact[0] : contact })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to update contact" })
  }
}

/**
 * DELETE /admin/domains/contacts/:id
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const service: any = req.scope.resolve(DOMAINS_MODULE)

    const existing = await service
      .retrieveDomainContact(req.params.id)
      .catch(() => null)
    if (!existing || existing.tenant_id !== TENANT_ID) {
      return res.status(404).json({ message: "Contact was not found" })
    }

    await service.deleteDomainContacts(req.params.id)

    res.json({ id: req.params.id, object: "domain_contact", deleted: true })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to delete contact" })
  }
}
