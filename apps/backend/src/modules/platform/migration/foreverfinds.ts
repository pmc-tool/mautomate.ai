import type { MedusaContainer } from "@medusajs/framework/types"

import { PLATFORM_MODULE } from "../index"

/**
 * Forever Finds = tenant #1 (plan §09), registered with the SAFEST possible
 * cutover: MAP-TO-DEFAULT. FF's data stays scoped `tenant_id="default"` (its
 * backend boots with TENANT_ID unset, so resolveTenantId() returns "default"),
 * so there is NO live UPDATE of the already-scoped rows and core commerce is
 * untouched. We only ADD a control-plane tenant row + a foreverfinds.shop
 * hostname pointing at the existing instance. Rollback is "unregister".
 *
 * `planForeverFindsRegistration` is a pure description (for the runbook + tests);
 * `registerForeverFinds` performs the additive control-plane writes.
 */
export const FF_SLUG = "foreverfinds"
export const FF_DATA_TENANT = "default"
export const FF_DOMAIN = "foreverfinds.shop"

export type RegistrationStep = { step: string; mutates: "control_plane" | "none"; reversible: boolean }

export const planForeverFindsRegistration = (): RegistrationStep[] => [
  { step: "create control-plane tenant row (maps to data tenant 'default')", mutates: "control_plane", reversible: true },
  { step: "add tenant_domain foreverfinds.shop → this tenant (additive)", mutates: "control_plane", reversible: true },
  { step: "record existing backend_url as the instance pointer", mutates: "control_plane", reversible: true },
  { step: "NO remap of FF data rows — they stay tenant_id='default'", mutates: "none", reversible: true },
]

export type RegisterInput = { backend_url?: string; package?: string }

export async function registerForeverFinds(
  container: MedusaContainer,
  input: RegisterInput = {}
): Promise<{ tenant_id: string; domain: string; data_tenant: string }> {
  const svc = container.resolve(PLATFORM_MODULE) as any

  const existing = await svc.listTenants({ slug: FF_SLUG }, { take: 1 })
  let tenant = existing?.[0]
  if (!tenant) {
    ;[tenant] = await svc.createTenants([
      {
        slug: FF_SLUG,
        name: "Forever Finds",
        package: input.package ?? "scale",
        status: "live",
        backend_url: input.backend_url ?? process.env.FF_BACKEND_URL ?? null,
        provisioned_at: new Date(),
        meta: { data_tenant_id: FF_DATA_TENANT, migrated: true },
      },
    ])
  }

  const dom = await svc.listTenantDomains({ domain: FF_DOMAIN }, { take: 1 })
  if (!dom?.length) {
    await svc.createTenantDomains([
      {
        tenant_id: tenant.id,
        domain: FF_DOMAIN,
        type: "custom",
        is_primary: true,
        ssl_status: "active", // existing tunnel already serves valid TLS
        verification_status: "verified",
      },
    ])
  }

  return { tenant_id: tenant.id, domain: FF_DOMAIN, data_tenant: FF_DATA_TENANT }
}

/** Rollback: unregister (delete the additive control-plane rows). Data untouched. */
export async function unregisterForeverFinds(
  container: MedusaContainer
): Promise<void> {
  const svc = container.resolve(PLATFORM_MODULE) as any
  const doms = await svc.listTenantDomains({ domain: FF_DOMAIN })
  if (doms?.length) await svc.deleteTenantDomains(doms.map((d: any) => d.id))
  const tenants = await svc.listTenants({ slug: FF_SLUG })
  if (tenants?.length) await svc.deleteTenants(tenants.map((t: any) => t.id))
}
