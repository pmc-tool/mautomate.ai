import type { MedusaContainer } from "@medusajs/framework/types"

import { ReconciliationService } from "../modules/platform/observability/reconciliation"

/**
 * platform-nightly-reconcile — the nightly credit-vs-ledger reconciliation the
 * risk register requires. Flags any tenant whose wallet balance drifts from the
 * append-only ledger (a bug or tampering). No-op unless PLATFORM_ENABLED; no-throw.
 */
export default async function platformNightlyReconcile(
  container: MedusaContainer
): Promise<void> {
  if (process.env.PLATFORM_ENABLED !== "true") return
  try {
    const drifted = await new ReconciliationService(container).reconcileWallets()
    if (drifted.length) {
      // eslint-disable-next-line no-console
      console.error(
        `[platform] nightly reconcile: ${drifted.length} wallet(s) drifted: ` +
          drifted.map((d) => `${d.tenant_id}=${d.drift}`).join(", ")
      )
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[platform] nightly reconcile failed:", e)
  }
}

export const config = {
  name: "platform-nightly-reconcile",
  schedule: "0 3 * * *", // 03:00 daily
}
