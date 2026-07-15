import { resolveTenantId } from "../../../lib/tenant-context"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { CALL_CENTER_MODULE } from "../../../modules/call-center"
import { getLedger } from "../../../modules/platform/credits/metering"
import { creditsFor } from "../../../modules/platform/pricing/price-book"

/**
 * POST /telephony/call-ended  (UNPREFIXED — escapes /admin + /store auth)
 *
 * End-of-call webhook from the voice runtime. Persists the final artifacts of a
 * call onto its `call_center_call` row and, if the runtime supplied a
 * disposition and none is recorded yet, opens a `call_center_disposition`.
 *
 * Body: `{ call_id, tenant_id, transcript, summary?, sentiment?, disposition?,
 *          cost_total?, recording_url?, ended_reason? }`.
 *
 * NO-THROW: like the Twilio status callback this must never fail the caller —
 * any error is logged and we still return 200 (the runtime does not retry on a
 * body-level error, and a lost persistence is not worth a 500).
 *
 * Lookup mirrors the status webhook: resolve the Call by our id first, then by
 * `provider_call_id`.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as Record<string, unknown>

  const callId = typeof body.call_id === "string" ? body.call_id : ""
  const tenantId =
    (typeof body.tenant_id === "string" && body.tenant_id) ||
    (resolveTenantId("CALL_CENTER_DEFAULT_TENANT"))

  try {
    if (callId) {
      const service: any = req.scope.resolve(CALL_CENTER_MODULE)

      // Resolve the Call: by our id, else by provider_call_id.
      let call: any = null
      try {
        call = await service.retrieveCall(callId)
      } catch {
        // Not our id — fall back to the provider id lookup below.
      }
      if (!call) {
        const rows = await service.listCalls(
          { provider_call_id: callId, tenant_id: tenantId },
          { take: 1 }
        )
        call = rows?.[0] ?? null
      }

      if (call) {
        const update: Record<string, unknown> = {
          id: call.id,
          status: "completed",
          ended_at: call.ended_at ?? new Date(),
        }
        if (body.transcript !== undefined) {
          update.transcript = body.transcript
        }
        if (typeof body.summary === "string") {
          update.summary = body.summary
        }
        if (typeof body.sentiment === "string") {
          update.sentiment = body.sentiment
        }
        if (typeof body.recording_url === "string") {
          update.recording_url = body.recording_url
        }
        if (typeof body.cost_total === "number") {
          update.cost_total = body.cost_total
        }
        const disposition =
          typeof body.disposition === "string" ? body.disposition : null
        if (disposition) {
          update.disposition = disposition
        }

        // P6 METERING — price the call in credits (1 credit = $0.01), billed per
        // ai_call_minute. Duration comes from the runtime; a call that never
        // connected (0s) is not charged. cost_total displays the credits charged.
        let callCredits = 0
        const durationSeconds =
          typeof body.duration_seconds === "number" ? body.duration_seconds : 0
        // A phone call carries a telco leg (Twilio) that a web call doesn't —
        // so it costs us more and is priced higher.
        const isPhone = !!((call as any).from_number || (call as any).to_number)
        const callAction = isPhone ? "ai_call_phone_minute" : "ai_call_minute"
        if (durationSeconds > 0) {
          const minutes = Math.max(1, Math.ceil(durationSeconds / 60))
          callCredits = creditsFor(callAction, minutes)
          update.cost_total = callCredits
        }

        await service.updateCalls(update)

        // Debit the wallet of the CALL ROW's tenant (authoritative — never the
        // request body). Idempotent on the call id so a webhook retry can't
        // double-charge. No-throw: a billing hiccup never fails call-ended.
        if (callCredits > 0 && call.tenant_id) {
          try {
            const ledger = getLedger(req.scope)
            const r = await ledger.clawback(call.tenant_id, callCredits, {
              idempotencyKey: `call:${call.id}`,
            })
            // Voice settles post-paid (clawback, not reserve/commit), so the
            // usage row has to be written explicitly — otherwise call minutes
            // are invisible to the margin dashboard.
            const billedMinutes = Math.max(1, Math.ceil(durationSeconds / 60))
            await ledger.settleUsage(
              call.tenant_id,
              callAction,
              billedMinutes,
              callCredits,
              { call_id: call.id, channel: isPhone ? "phone" : "web" }
            )
            if (r.suspend) {
              // eslint-disable-next-line no-console
              console.warn(
                `[billing] tenant ${call.tenant_id} wallet negative after call ${call.id} — suspend signal.`
              )
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error("[billing] failed to meter call cost (non-blocking):", e)
          }
        }

        // Open a disposition row only if one supplied AND none exists yet.
        if (disposition) {
          const existing = await service.listDispositions(
            { call_id: call.id, tenant_id: tenantId },
            { take: 1 }
          )
          if (!existing?.length) {
            const endedReason =
              typeof body.ended_reason === "string" ? body.ended_reason : null
            await service.createDispositions({
              tenant_id: tenantId,
              call_id: call.id,
              outcome: disposition,
              reason: endedReason,
              notes: typeof body.summary === "string" ? body.summary : null,
              set_by: "ai_call",
            })
          }
        }
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[telephony] failed to persist call-ended payload:", e)
  }

  res.status(200).json({ received: true })
}
