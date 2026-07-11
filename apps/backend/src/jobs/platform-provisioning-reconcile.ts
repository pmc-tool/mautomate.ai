import type { MedusaContainer } from "@medusajs/framework/types"

import { ProvisioningService } from "../modules/platform/provisioning-service"

/**
 * platform-provisioning-reconcile (scheduled sweep, every 5 minutes).
 *
 * The self-healing backstop for the provisioning saga: a job left running /
 * compensating / pending past the stuck threshold (a crash between steps, a
 * dropped worker) is flagged failed so it can be retried or compensated rather
 * than hanging forever.
 *
 * MASTER FLAG: no-op unless PLATFORM_ENABLED === "true", so it stays inert on
 * the current single-tenant deployment. No-throw; logs a summary.
 */
export default async function platformProvisioningReconcile(
  container: MedusaContainer
): Promise<void> {
  if (process.env.PLATFORM_ENABLED !== "true") {
    return
  }
  try {
    const svc = new ProvisioningService(container)
    const stuck = await svc.reconcile()
    if (stuck.length) {
      // eslint-disable-next-line no-console
      console.error(
        `[platform] provisioning reconcile: flagged ${stuck.length} stuck job(s): ${stuck.join(", ")}`
      )
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[platform] provisioning reconcile sweep failed:", e)
  }
}

export const config = {
  name: "platform-provisioning-reconcile",
  schedule: "*/5 * * * *",
}
