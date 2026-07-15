import type { MedusaContainer } from "@medusajs/framework/types"

import { getLedger } from "../modules/platform/credits/metering"

/**
 * Stranded-reservation reaper.
 *
 * A crash (or a killed process) between `reserve` and `commit/release` leaves
 * credits held forever: the merchant's balance is debited but nothing was ever
 * delivered. The ledger has always had `reapExpired()` — nothing ever called it.
 * This runs it, so holds older than the 15-minute TTL are returned to the wallet.
 */
export default async function creditReaperJob(container: MedusaContainer) {
  const logger: any = container.resolve("logger")
  try {
    const ledger = getLedger(container)
    const released = await ledger.reapExpired()
    const n = Array.isArray(released) ? released.length : Number(released ?? 0)
    if (n > 0) {
      logger.info(`[credit-reaper] released ${n} stranded reservation(s)`)
    }
  } catch (e: any) {
    logger.error(`[credit-reaper] ${e?.message ?? e}`)
  }
}

export const config = {
  name: "credit-reaper",
  schedule: "*/5 * * * *", // every 5 minutes
}
