import type { MedusaContainer } from "@medusajs/framework/types"

import { PLATFORM_MODULE } from "../index"
import { SUBPROCESSORS } from "./subprocessors"

/**
 * DSAR — data-subject access & erasure (plan §05 / GDPR Arts. 15 & 17).
 *
 * `planErasure` is a PURE description of everything that must be deleted for a
 * tenant, INCLUDING propagation tasks to sub-processors that hold copies (call
 * recordings at Deepgram/ElevenLabs, etc.) — so an erasure request is auditable
 * and complete, not just a local delete. `exportTenant` gathers the portable
 * copy; `eraseTenant` executes the local deletes and records the sub-processor
 * propagation tasks.
 */
export type ErasureTask = {
  target: string
  kind: "local" | "subprocessor"
  action: string
}

/** The full set of deletions/propagations an erasure must cover. */
export const planErasure = (tenantId: string): ErasureTask[] => {
  const local: ErasureTask[] = [
    { target: "tenant_config", kind: "local", action: `purge secrets+config for ${tenantId}` },
    { target: "tenant_key", kind: "local", action: `destroy DEK for ${tenantId}` },
    { target: "credit_transaction", kind: "local", action: `anonymize ledger for ${tenantId} (retain financial totals)` },
    { target: "usage_event", kind: "local", action: `delete usage events for ${tenantId}` },
    { target: "audit_log", kind: "local", action: `retain (legal basis) — do not delete` },
    { target: "tenant_instance", kind: "local", action: `destroy DB + container for ${tenantId}` },
  ]
  const propagations: ErasureTask[] = SUBPROCESSORS.filter((s) =>
    ["Deepgram", "ElevenLabs", "OpenAI", "Twilio"].includes(s.name)
  ).map((s) => ({
    target: s.name,
    kind: "subprocessor",
    action: `request deletion of ${s.data.toLowerCase()} for ${tenantId}`,
  }))
  return [...local, ...propagations]
}

export class DsarService {
  constructor(private readonly container: MedusaContainer) {}
  private svc(): any {
    return this.container.resolve(PLATFORM_MODULE)
  }

  /** Portable export of a tenant's control-plane record (config secrets redacted). */
  async exportTenant(tenantId: string): Promise<Record<string, unknown>> {
    const svc = this.svc()
    const [tenant] = await svc.listTenants({ id: tenantId }, { take: 1 })
    const domains = await svc.listTenantDomains({ tenant_id: tenantId })
    const usage = await svc.listUsageEvents({ tenant_id: tenantId })
    const configs = await svc.listTenantConfigs({ tenant_id: tenantId })
    return {
      tenant,
      domains,
      usage,
      config: (configs ?? []).map((c: any) => ({
        key: c.key,
        is_secret: c.is_secret,
        value: c.is_secret ? "[redacted]" : c.value_plain,
      })),
    }
  }

  /**
   * Execute the erasure: local deletes now, sub-processor propagations returned
   * as tasks to be dispatched + tracked (they are async, external).
   */
  async eraseTenant(tenantId: string): Promise<{ done: string[]; propagate: ErasureTask[] }> {
    const svc = this.svc()
    const done: string[] = []

    const configs = await svc.listTenantConfigs({ tenant_id: tenantId })
    if (configs?.length) {
      await svc.deleteTenantConfigs(configs.map((c: any) => c.id))
      done.push("tenant_config")
    }
    const keys = await svc.listTenantKeys({ tenant_id: tenantId })
    if (keys?.length) {
      await svc.deleteTenantKeys(keys.map((k: any) => k.id))
      done.push("tenant_key")
    }
    const usage = await svc.listUsageEvents({ tenant_id: tenantId })
    if (usage?.length) {
      await svc.deleteUsageEvents(usage.map((u: any) => u.id))
      done.push("usage_event")
    }

    const propagate = planErasure(tenantId).filter((t) => t.kind === "subprocessor")
    return { done, propagate }
  }
}

export default DsarService
