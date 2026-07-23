import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { storeTenant } from "../../../_tenant"

type ChangeEmailBody = {
  email?: string
  password?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Authenticated email change for a store customer.
 *
 * Medusa core does not support changing the login email from the store API:
 * the emailpass credential keys on `provider_identity.entity_id`, which in this
 * pooled backend is tenant-namespaced (`<tenant_id>:<email>`, see
 * `namespaceCustomerAuthIdentity` in api/middlewares.ts) while the DISPLAYED
 * `customer.email` stays raw. Both must move together or login and display
 * drift apart.
 *
 * Security: requires the CURRENT password (re-verified through the emailpass
 * provider) — a stolen session alone cannot take over the account's email.
 * The route is registered behind `authenticate("customer")` + the auth
 * brute-force limiter in api/middlewares.ts.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<ChangeEmailBody>,
  res: MedusaResponse
) => {
  const actorId = req.auth_context?.actor_id
  if (!actorId) {
    res.status(401).json({ type: "unauthorized", message: "Unauthorized" })
    return
  }

  const body = (req.body ?? {}) as ChangeEmailBody
  const newEmail = String(body.email ?? "").trim()
  const password = String(body.password ?? "")

  if (!EMAIL_RE.test(newEmail)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Enter a valid email address."
    )
  }
  if (!password) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Your current password is required to change your email."
    )
  }

  // Fail closed: an email change must always be scoped to its store.
  const tenant = await storeTenant(req)
  if (!tenant) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Could not resolve the store for this request."
    )
  }

  const customerModule: any = req.scope.resolve(Modules.CUSTOMER)
  const customer = await customerModule
    .retrieveCustomer(actorId)
    .catch(() => null)
  if (!customer) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Customer not found")
  }

  const currentEmail = String(customer.email ?? "")
  if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
    res.status(200).json({
      success: true,
      customer: { id: customer.id, email: currentEmail },
    })
    return
  }

  // 1. Re-verify the current password against the emailpass identity. The
  //    tenant-namespaced identifier is authoritative; the raw email covers
  //    legacy identities created before namespacing.
  const authModule: any = req.scope.resolve(Modules.AUTH)
  const candidates = [`${tenant.id}:${currentEmail}`, currentEmail]
  let verifiedEntityId: string | null = null
  for (const identifier of candidates) {
    const result = await authModule
      .authenticate("emailpass", {
        url: req.url ?? "",
        headers: {},
        query: {},
        protocol: "https",
        body: { email: identifier, password },
      })
      .catch(() => null)
    if (result?.success) {
      verifiedEntityId = identifier
      break
    }
  }
  if (!verifiedEntityId) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "The current password you entered is incorrect."
    )
  }

  const pg: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const newEntityId = `${tenant.id}:${newEmail}`

  // 2. Per-store uniqueness: refuse if the new email already has a login on
  //    THIS store (other stores may freely use the same email).
  const existing = await pg.raw(
    "select id from provider_identity where provider = 'emailpass' and lower(entity_id) = lower(?) limit 1",
    [newEntityId]
  )
  if (existing?.rows?.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "An account with this email already exists on this store."
    )
  }

  // 3. Move the login identity, then the displayed email. If the second write
  //    fails, roll the identity back so login and display never diverge.
  const moved = await pg.raw(
    "update provider_identity set entity_id = ? where provider = 'emailpass' and entity_id = ? returning id",
    [newEntityId, verifiedEntityId]
  )
  if (!moved?.rows?.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Could not update your sign-in identity. Please try again."
    )
  }

  try {
    await customerModule.updateCustomers(customer.id, { email: newEmail })
  } catch (error) {
    await pg
      .raw(
        "update provider_identity set entity_id = ? where provider = 'emailpass' and entity_id = ?",
        [verifiedEntityId, newEntityId]
      )
      .catch(() => {})
    throw error
  }

  res.status(200).json({
    success: true,
    customer: { id: customer.id, email: newEmail },
  })
}
