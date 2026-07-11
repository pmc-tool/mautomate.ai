/**
 * Suppression service — the do-not-email list guard + writer.
 *
 * Every marketing send consults `isSuppressed` first; an address on the list is
 * skipped. `suppress` is the idempotent writer used by one-click unsubscribes,
 * hard bounces, and complaints — it also best-effort flips the matching
 * contact's `unsubscribed_at` so the consent lifecycle stays in sync.
 *
 * NO-THROW: recipient-facing routes call these, so every function degrades
 * gracefully (never throws) — a lookup failure reads as "not suppressed" and a
 * write failure is swallowed after best-effort. Reads/writes are tenant-scoped.
 */

import type { MedusaContainer } from "@medusajs/framework/types"
import { MARKETING_MODULE } from "../index"
import type MarketingModuleService from "../service"

const resolveService = (
  container: MedusaContainer
): MarketingModuleService => container.resolve(MARKETING_MODULE)

/**
 * True when `email` is on `tenantId`'s suppression list. No-throw: any failure
 * resolves to `false` (fail-open on read is intentional — a broken suppression
 * lookup must not block the route, and the send path has its own safeguards).
 */
export const isSuppressed = async (
  container: MedusaContainer,
  tenantId: string,
  email: string
): Promise<boolean> => {
  try {
    const svc = resolveService(container)
    const rows = await svc.listMarketingSuppressions({
      tenant_id: tenantId,
      email,
    } as any)
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return false
  }
}

/**
 * Idempotently add `email` to `tenantId`'s suppression list. Skips the insert
 * when already suppressed, then best-effort stamps the matching contact's
 * `unsubscribed_at`. No-throw: swallows every error after best-effort.
 */
export const suppress = async (
  container: MedusaContainer,
  {
    tenantId,
    email,
    reason,
    source,
  }: {
    tenantId: string
    email: string
    reason: "unsubscribe" | "bounce" | "complaint" | "manual"
    source?: string
  }
): Promise<void> => {
  try {
    const svc = resolveService(container)

    const already = await isSuppressed(container, tenantId, email)
    if (!already) {
      await svc.createMarketingSuppressions({
        tenant_id: tenantId,
        email,
        reason,
        source: source ?? null,
      } as any)
    }

    // Best-effort: mark the matching contact unsubscribed.
    try {
      const contacts = await svc.listMarketingContacts({
        tenant_id: tenantId,
        email,
      } as any)
      const list = Array.isArray(contacts) ? contacts : []
      if (list.length) {
        await svc.updateMarketingContacts(
          list.map((c: any) => ({
            id: c.id,
            unsubscribed_at: new Date(),
          })) as any
        )
      }
    } catch {
      // contact sync is best-effort — ignore.
    }
  } catch {
    // never throw from the recipient-facing path.
  }
}

/**
 * Paginated, tenant-scoped listing of suppression rows.
 * Returns `{ suppressions, count, limit, offset }`; empty on any failure.
 */
export const listSuppressions = async (
  container: MedusaContainer,
  {
    tenantId,
    limit,
    offset,
  }: { tenantId: string; limit?: number; offset?: number }
): Promise<{
  suppressions: any[]
  count: number
  limit: number
  offset: number
}> => {
  const take = limit ?? 50
  const skip = offset ?? 0
  try {
    const svc = resolveService(container)
    const [suppressions, count] = await svc.listAndCountMarketingSuppressions(
      { tenant_id: tenantId } as any,
      { take, skip, order: { created_at: "DESC" } } as any
    )
    return {
      suppressions: Array.isArray(suppressions) ? suppressions : [],
      count: count ?? 0,
      limit: take,
      offset: skip,
    }
  } catch {
    return { suppressions: [], count: 0, limit: take, offset: skip }
  }
}
