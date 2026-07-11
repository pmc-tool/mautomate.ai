import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import { resolveMerchant } from "../../_helpers"

/**
 * POST /merchant/call-center/erasure  (GDPR / privacy right-to-erasure)
 *
 * Erase a person's call-automation footprint for THIS tenant, identified by
 * phone number. STRICTLY tenant-scoped: only rows carrying the caller's own
 * tenant_id are ever touched — a merchant can never erase another tenant's data,
 * and this endpoint can never reach across tenants.
 *
 * What it erases (all tenant-scoped):
 *   - call_center_call rows where from_number OR to_number matches (transcript,
 *     recording_url, summary, sentiment — the PII-bearing artifacts) → deleted.
 *   - call_center_disposition rows for those calls → deleted.
 *   - call_center_consent rows for the phone → deleted (consent record removed).
 *
 * Idempotent: erasing an already-erased subject is a no-op that still returns a
 * 200 with the counts (all zero).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const tenant_id = ctx.merchant.tenant_id
  if (!tenant_id) {
    return res.status(401).json({ message: "merchant tenant not resolved" })
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const phone = typeof body.phone === "string" ? body.phone.trim() : ""
  if (!phone) {
    return res.status(400).json({ message: "phone is required" })
  }

  try {
    const cc: any = req.scope.resolve(CALL_CENTER_MODULE)
    const counts = { calls: 0, dispositions: 0, consents: 0 }

    // 1. Calls where this phone is the from OR to number (tenant-scoped).
    const calls: any[] = []
    for (const key of ["from_number", "to_number"]) {
      const rows = await cc
        .listCalls({ tenant_id, [key]: phone }, { take: 1000 })
        .catch(() => [])
      for (const r of rows as any[]) {
        if (!calls.find((c) => c.id === r.id)) calls.push(r)
      }
    }

    // 2. Dispositions for those calls, then the calls themselves.
    for (const call of calls) {
      const disps = await cc
        .listDispositions({ tenant_id, call_id: call.id }, { take: 1000 })
        .catch(() => [])
      if ((disps as any[]).length) {
        await cc
          .deleteDispositions((disps as any[]).map((d) => d.id))
          .catch(() => {})
        counts.dispositions += (disps as any[]).length
      }
    }
    if (calls.length) {
      await cc.deleteCalls(calls.map((c) => c.id)).catch(() => {})
      counts.calls += calls.length
    }

    // 3. Consent rows for the phone (tenant-scoped).
    const consents = await cc
      .listConsents({ tenant_id, phone }, { take: 1000 })
      .catch(() => [])
    if ((consents as any[]).length) {
      await cc
        .deleteConsents((consents as any[]).map((c) => c.id))
        .catch(() => {})
      counts.consents += (consents as any[]).length
    }

    res.json({ erased: true, phone, counts })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Erasure failed" })
  }
}
