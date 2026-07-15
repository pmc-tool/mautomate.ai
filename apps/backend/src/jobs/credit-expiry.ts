import type { MedusaContainer } from "@medusajs/framework/types"

import { getLedger } from "../modules/platform/credits/metering"

/**
 * Expire plan/trial credit lots past their date.
 *
 * Purchased (top-up) credits carry no expiry date, so this can never touch
 * them — that guarantee is enforced in the ledger, not by this job's caution.
 */
export default async function creditExpiryJob(container: MedusaContainer) {
  const logger: any = container.resolve("logger")
  try {
    const { tenants, credits } = await getLedger(container).expireLots()
    if (credits > 0) {
      logger.info(`[credit-expiry] expired ${credits} credit(s) across ${tenants} tenant(s)`)
    }
  } catch (e: any) {
    logger.error(`[credit-expiry] ${e?.message ?? e}`)
  }
}

export const config = {
  name: "credit-expiry",
  schedule: "17 * * * *", // hourly, off the hour
}
