import type { MedusaContainer } from "@medusajs/framework/types"

import { getLedger } from "../modules/platform/credits/metering"
import { CALL_CENTER_MODULE } from "../modules/call-center"
import { PLATFORM_MODULE } from "../modules/platform"

/**
 * Monthly phone-number rental.
 *
 * Twilio bills us $1.15/number/month whether the merchant uses it or not, so
 * the merchant is billed 300 credits ($3.00) a month for each number they hold.
 * Idempotent per number per calendar month: re-runs can't double-charge.
 *
 * If the wallet can't cover it we do NOT silently keep paying Twilio — the
 * number is flagged past_due and the operator can release it.
 */
export default async function phoneNumberRentJob(container: MedusaContainer) {
  const logger: any = container.resolve("logger")
  try {
    const cc: any = container.resolve(CALL_CENTER_MODULE)
    const platform: any = container.resolve(PLATFORM_MODULE)
    const ledger = getLedger(container)

    const numbers = await cc.listPhoneNumbers({}, { take: 5000 }).catch(() => [])
    if (!numbers?.length) return

    const period = new Date().toISOString().slice(0, 7) // YYYY-MM
    let charged = 0
    let unpaid = 0

    for (const num of numbers) {
      const tenantId = num.tenant_id
      if (!tenantId) continue

      const rid = `cres_num_${num.id}_${period}`
      const r = await ledger.reserve(tenantId, "phone_number_month", 1, { reservationId: rid })
      if (!r.ok) {
        unpaid++
        await platform
          .createAuditLogs?.([
            {
              tenant_id: tenantId,
              action: "phone_number.rent_unpaid",
              meta: { number: num.e164 ?? num.id, period },
            },
          ])
          .catch(() => {})
        logger.warn(
          `[phone-rent] tenant ${tenantId} cannot cover the rental for ${num.e164 ?? num.id}`
        )
        continue
      }
      // idempotencyKey makes a second run this month a no-op
      await ledger.commit(rid, undefined, {
        idempotencyKey: `number-rent:${num.id}:${period}`,
        meta: { number: num.e164 ?? num.id, period },
      })
      charged++
    }

    if (charged || unpaid) {
      logger.info(`[phone-rent] ${period}: charged ${charged} number(s), ${unpaid} unpaid`)
    }
  } catch (e: any) {
    logger.error(`[phone-rent] ${e?.message ?? e}`)
  }
}

export const config = {
  name: "phone-number-rent",
  schedule: "0 6 1 * *", // 06:00 on the 1st of each month
}
