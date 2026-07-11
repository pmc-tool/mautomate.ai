import crypto from "crypto"
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { provisionTenantWorkflow } from "../../../../workflows/platform/provision-tenant"
import { createMerchantIdentity } from "../../../platform/_provision-helpers"
import { validateSlug } from "../../../../modules/platform/abuse/quota"
import { PLATFORM_MODULE } from "../../../../modules/platform"

const ROOT = process.env.PLATFORM_ROOT_DOMAIN ?? "mautomate.ai"

/** Guaranteed-valid strong password: upper + lower + digit, 20 chars. */
const genPassword = () =>
  "Aa1" + crypto.randomBytes(12).toString("hex").slice(0, 17)

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * POST /admin/platform/provision
 *
 * Super-admin endpoint to provision a new pooled tenant on the shared Medusa
 * backend. The tenant is isolated by sales channel + publishable API key; no
 * per-tenant instance, database, or process is created. The caller can supply
 * owner credentials or let the platform generate a strong password.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const b = (req.body ?? {}) as any

  const slugCheck = validateSlug(String(b.slug ?? ""))
  if (!slugCheck.ok) {
    return res.status(400).json({ message: `invalid slug (${slugCheck.reason})` })
  }
  const slug = slugCheck.slug
  const name = String(b.name || slug).slice(0, 60)

  const adminEmail = String(b.admin_email ?? `owner@${slug}.${ROOT}`).trim().toLowerCase()
  const adminPassword = String(b.admin_password ?? genPassword())

  if (!EMAIL_RE.test(adminEmail)) {
    return res.status(400).json({ message: "invalid admin_email" })
  }
  if (adminPassword.length < 8) {
    return res.status(400).json({ message: "admin_password must be at least 8 characters" })
  }

  const svc: any = req.scope.resolve(PLATFORM_MODULE)

  const [taken, domainTaken, emailTaken] = await Promise.all([
    svc.listTenants({ slug }, { take: 1 }),
    svc.listTenantDomains({ domain: `${slug}.${ROOT}` }, { take: 1 }),
    svc.listMerchants({ email: adminEmail }),
  ])

  if (taken?.length || domainTaken?.length) {
    return res.status(409).json({ message: `${slug}.${ROOT} is already taken` })
  }
  if (emailTaken?.length) {
    return res.status(409).json({ message: `merchant email ${adminEmail} is already registered` })
  }

  const { result, errors } = await provisionTenantWorkflow(req.scope).run({
    input: {
      slug,
      name,
      trial_credits: Number.isFinite(+b.trial_credits) ? +b.trial_credits : undefined,
    },
    throwOnError: false,
  })

  if (errors?.length) {
    return res.status(500).json({
      message: "provisioning failed",
      errors: errors.map((e: any) => String(e?.error?.message ?? e?.error ?? e)),
    })
  }

  const tenantId = (result as any)?.tenant_id
  if (!tenantId) {
    return res.status(500).json({ message: "provisioning returned no tenant_id" })
  }

  // Create the merchant control-plane identity for the owner.
  const identity = await createMerchantIdentity(req.scope, {
    tenantId,
    email: adminEmail,
    password: adminPassword,
    name: String(b.owner_name ?? "").trim() || undefined,
  })

  if (!identity.ok) {
    // Rollback the tenant so a retry can succeed.
    await svc.updateTenants({ id: tenantId, status: "failed" }).catch(() => undefined)
    return res.status(500).json({
      message: "tenant created, but merchant identity creation failed",
      error: identity.error,
    })
  }

  await svc.updateTenants({
    id: tenantId,
    trial_ends_at: new Date(Date.now() + 14 * 864e5),
  })

  const tenant = await svc.retrieveTenant(tenantId).catch(() => null)

  res.status(201).json({
    tenant: {
      id: tenantId,
      slug,
      name,
      status: tenant?.status ?? "live",
      store_url: `https://${slug}.${ROOT}`,
      admin_url: `https://${slug}.${ROOT}/admin`,
      merchant_login_url: `https://merchant.${ROOT}`,
      publishable_key: tenant?.publishable_key ?? null,
    },
    merchant: {
      id: identity.merchant_id,
      email: adminEmail,
      password: adminPassword,
    },
  })
}
