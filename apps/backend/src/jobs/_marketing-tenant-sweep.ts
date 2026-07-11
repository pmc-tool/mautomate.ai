import type { MedusaContainer } from "@medusajs/framework/types"

import { PLATFORM_MODULE } from "../modules/platform"
import { withTenant } from "../lib/tenant-context"

export interface SweepSummary {
  [key: string]: number
}

export type SweepFn<S extends SweepSummary> = (
  container: MedusaContainer
) => Promise<S> | S

/**
 * Run a marketing sweep once per active tenant, wrapping each call in the
 * request-scoped tenant context so the runner resolves the correct tenant
 * instead of falling back to process.env. Per-tenant failures are isolated:
 * one broken tenant does not abort the sweep for the rest of the platform.
 *
 * Numeric fields in each per-tenant summary are summed into a platform total.
 */
export async function runForEachTenant<S extends SweepSummary>(
  container: MedusaContainer,
  name: string,
  sweep: SweepFn<S>
): Promise<S> {
  const logger: any = container.resolve("logger")
  const svc: any = container.resolve(PLATFORM_MODULE)

  let tenants: Array<{ id: string }> = []
  try {
    tenants = await svc.listTenants({ status: "active" }, { take: 10000 })
  } catch (e) {
    logger.error(`[marketing] ${name}: failed to list tenants`, e as any)
    return {} as S
  }

  const totals: Record<string, number> = {}

  await Promise.all(
    tenants.map(async (tenant) =>
      withTenant(tenant.id, async () => {
        try {
          const summary = await sweep(container)
          for (const [key, value] of Object.entries(summary)) {
            if (typeof value === "number") {
              totals[key] = (totals[key] ?? 0) + value
            }
          }
        } catch (e) {
          logger.error(
            `[marketing] ${name} failed for tenant ${tenant.id}`,
            e as any
          )
        }
      })
    )
  )

  return totals as S
}
