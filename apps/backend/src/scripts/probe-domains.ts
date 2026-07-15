import { PLATFORM_MODULE } from "../modules/platform"
import type { MedusaContainer } from "@medusajs/framework/types"

export default async function probe({ container }: { container: MedusaContainer }) {
  const svc: any = container.resolve(PLATFORM_MODULE)
  const T = "ten_01KX0E4CRKZCYCD6CR22P8GBBQ"
  const rows = await svc.listTenantDomains({ tenant_id: T })
  console.log("[probe] rows returned for tenant:", Array.isArray(rows) ? rows.length : rows)
  for (const d of rows ?? []) {
    console.log("[probe]   domain=%s type=%j tenant=%s", d.domain, d.type, d.tenant_id)
  }
  const hasDomain = (rows || []).some((d: any) => d.type !== "free")
  console.log("[probe] hasDomain (type !== 'free') =", hasDomain)
}
