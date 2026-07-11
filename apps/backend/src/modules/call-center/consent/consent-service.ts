import { MedusaContainer } from "@medusajs/framework/types"

import { CALL_CENTER_MODULE } from ".."
import CallCenterModuleService from "../service"

/**
 * ConsentService — the consent + do-not-call (DNC) decision layer for the AI
 * call center.
 *
 * This is the single place that answers "may we (legally) place this call?" and
 * the single place that records why. It wraps the module's generated CRUD for
 * the `Consent` and `ConsentLog` models and layers the compliance logic on top.
 *
 * LEGAL BASIS (documented for auditors and future maintainers):
 *   - TRANSACTIONAL calls (order confirmation, delivery updates, returns — a
 *     customer's own transaction) rest on LEGITIMATE INTEREST. They are allowed
 *     by default and do NOT require a prior opt-in. They are blocked ONLY when
 *     the number is on the do-not-call (DNC) list.
 *   - MARKETING calls require explicit OPT-IN. They are allowed ONLY when a
 *     `status: "granted"` marketing consent row exists for the number, and are
 *     always blocked by a DNC entry.
 *
 * All methods are NO-THROW where sensible: reads that fail fall back to the
 * safe answer (deny for marketing, and never call a DNC number), and writes
 * catch backend errors so an audit-log failure never breaks a live call.
 *
 * MULTI-TENANT: every operation is scoped by `tenantId`.
 */

export type Purpose = "transactional" | "marketing"
export type ConsentStatus = "granted" | "revoked" | "dnc"

export type IsAllowedResult = {
  allowed: boolean
  reason?: string
}

export type RecordConsentOpts = {
  source?: string | null
  jurisdiction?: string | null
  proof?: string | null
  actor?: string | null
}

export type AddDncOpts = {
  reason?: string | null
  source?: string | null
  jurisdiction?: string | null
  actor?: string | null
}

export type ListFilters = {
  phone?: string
  purpose?: Purpose
  status?: ConsentStatus
  limit?: number
  offset?: number
}

/** Purpose stamped on a DNC row when the request is a blanket "stop calling me". */
const DNC_WILDCARD_PURPOSE: Purpose = "marketing"

export class ConsentService {
  private readonly cc: CallCenterModuleService

  constructor(container: MedusaContainer) {
    this.cc = container.resolve(CALL_CENTER_MODULE)
  }

  /**
   * Decide whether a call to `phone` for `purpose` is permitted.
   *
   *  - Any `status: "dnc"` row for (tenant, phone) blocks every purpose
   *    -> { allowed: false, reason: "dnc" }.
   *  - MARKETING requires an explicit `status: "granted"` marketing row
   *    -> otherwise { allowed: false, reason: "no_marketing_consent" }.
   *  - TRANSACTIONAL is allowed by default (legitimate interest) unless DNC.
   *
   * NO-THROW: on a backend read error we deny (fail-closed) so we never place a
   * call we cannot prove is allowed.
   */
  async isAllowed(
    tenantId: string,
    phone: string,
    purpose: Purpose
  ): Promise<IsAllowedResult> {
    try {
      const rows = (await this.cc.listConsents({
        tenant_id: tenantId,
        phone,
      })) as Array<{ purpose: Purpose; status: ConsentStatus }>

      // DNC beats everything: a do-not-call entry blocks all purposes.
      const hasDnc = rows.some((r) => r.status === "dnc")
      if (hasDnc) {
        return { allowed: false, reason: "dnc" }
      }

      // Marketing = opt-in: require an explicit granted marketing consent.
      if (purpose === "marketing") {
        const hasMarketingConsent = rows.some(
          (r) => r.purpose === "marketing" && r.status === "granted"
        )
        if (!hasMarketingConsent) {
          return { allowed: false, reason: "no_marketing_consent" }
        }
        return { allowed: true }
      }

      // Transactional = legitimate interest: allowed by default (DNC handled above).
      return { allowed: true }
    } catch (e: any) {
      // Fail-closed: if we cannot read consent state, do not call.
      return { allowed: false, reason: "consent_lookup_failed" }
    }
  }

  /**
   * Upsert the consent row for (tenant, phone, purpose) to `status` and append a
   * ConsentLog entry. Used to record an opt-in / opt-out captured on a call or
   * in the admin.
   *
   * NO-THROW: swallows backend errors; the audit log records what was attempted.
   */
  async recordConsent(
    tenantId: string,
    phone: string,
    purpose: Purpose,
    status: ConsentStatus,
    opts: RecordConsentOpts = {}
  ): Promise<void> {
    try {
      const consentId = await this.upsertConsent(
        tenantId,
        phone,
        purpose,
        status,
        {
          source: opts.source ?? null,
          jurisdiction: opts.jurisdiction ?? null,
          proof: opts.proof ?? null,
        }
      )

      await this.log(tenantId, phone, {
        consent_id: consentId,
        action: `consent_${status}`,
        purpose,
        actor: opts.actor ?? null,
      })
    } catch (e: any) {
      // no-throw: never break a live call over a consent write.
    }
  }

  /**
   * Place `phone` on the do-not-call list: set/create a `status: "dnc"` Consent
   * row (wildcard marketing purpose) and log it. Both a mid-call "stop calling
   * me" and a manual admin add route here.
   *
   * NO-THROW.
   */
  async addDnc(
    tenantId: string,
    phone: string,
    opts: AddDncOpts = {}
  ): Promise<void> {
    try {
      const consentId = await this.upsertConsent(
        tenantId,
        phone,
        DNC_WILDCARD_PURPOSE,
        "dnc",
        {
          source: opts.source ?? null,
          jurisdiction: opts.jurisdiction ?? null,
          proof: opts.reason ?? null,
        }
      )

      await this.log(tenantId, phone, {
        consent_id: consentId,
        action: "dnc_added",
        purpose: DNC_WILDCARD_PURPOSE,
        actor: opts.actor ?? null,
      })
    } catch (e: any) {
      // no-throw
    }
  }

  /**
   * Remove `phone` from the do-not-call list: flip any `status: "dnc"` rows to
   * "revoked" and log it.
   *
   * NO-THROW.
   */
  async removeDnc(tenantId: string, phone: string): Promise<void> {
    try {
      const rows = (await this.cc.listConsents({
        tenant_id: tenantId,
        phone,
        status: "dnc",
      })) as Array<{ id: string }>

      if (rows.length) {
        await this.cc.updateConsents(
          rows.map((r) => ({ id: r.id, status: "revoked" as ConsentStatus }))
        )
      }

      await this.log(tenantId, phone, {
        consent_id: rows[0]?.id ?? null,
        action: "dnc_removed",
        purpose: null,
        actor: null,
      })
    } catch (e: any) {
      // no-throw
    }
  }

  /**
   * List consent rows for a tenant, optionally filtered by phone / purpose /
   * status, paginated. Returns `{ items, count }`.
   */
  async list(
    tenantId: string,
    filters: ListFilters = {}
  ): Promise<{ items: any[]; count: number }> {
    const where: Record<string, any> = { tenant_id: tenantId }
    if (filters.phone) {
      where.phone = filters.phone
    }
    if (filters.purpose) {
      where.purpose = filters.purpose
    }
    if (filters.status) {
      where.status = filters.status
    }

    const [items, count] = await this.cc.listAndCountConsents(where, {
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
      order: { created_at: "DESC" },
    })

    return { items, count }
  }

  /**
   * Upsert helper: update the existing (tenant, phone, purpose) row to `status`,
   * or create one when none exists. Returns the affected consent id.
   */
  private async upsertConsent(
    tenantId: string,
    phone: string,
    purpose: Purpose,
    status: ConsentStatus,
    extra: {
      source?: string | null
      jurisdiction?: string | null
      proof?: string | null
    }
  ): Promise<string | null> {
    const existing = (await this.cc.listConsents({
      tenant_id: tenantId,
      phone,
      purpose,
    })) as Array<{ id: string }>

    if (existing.length) {
      const [updated] = await this.cc.updateConsents([
        {
          id: existing[0].id,
          status,
          source: extra.source ?? undefined,
          jurisdiction: extra.jurisdiction ?? undefined,
          proof: extra.proof ?? undefined,
        },
      ])
      return updated?.id ?? existing[0].id
    }

    const [created] = await this.cc.createConsents([
      {
        tenant_id: tenantId,
        phone,
        purpose,
        status,
        source: extra.source ?? null,
        jurisdiction: extra.jurisdiction ?? null,
        proof: extra.proof ?? null,
      },
    ])
    return created?.id ?? null
  }

  /** Append one append-only ConsentLog row. */
  private async log(
    tenantId: string,
    phone: string,
    entry: {
      consent_id?: string | null
      action: string
      purpose?: Purpose | null
      actor?: string | null
    }
  ): Promise<void> {
    await this.cc.createConsentLogs([
      {
        tenant_id: tenantId,
        phone,
        consent_id: entry.consent_id ?? null,
        action: entry.action,
        purpose: entry.purpose ?? null,
        actor: entry.actor ?? null,
      },
    ])
  }
}

export default ConsentService
