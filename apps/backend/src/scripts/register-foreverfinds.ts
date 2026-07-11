import { PLATFORM_MODULE } from "../modules/platform"
import {
  registerForeverFinds,
  FF_SLUG,
} from "../modules/platform/migration/foreverfinds"

/**
 * Register Forever Finds as mAutomate tenant #1 (map-to-default — no data
 * remap; FF keeps tenant_id="default"). Idempotent. Also seeds a control-plane
 * credit wallet + a matching grant ledger entry (so nightly reconciliation nets
 * to zero) using standard CRUD only — the raw-SQL atomic path stays for the
 * load-tested metering rollout.
 *
 * Run: npx medusa exec ./src/scripts/register-foreverfinds.ts
 */
const SCALE_CREDITS = 10000

export default async function registerFF({ container }: any) {
  const logger = container.resolve("logger")
  const svc: any = container.resolve(PLATFORM_MODULE)

  const res = await registerForeverFinds(container, {
    backend_url:
      process.env.FF_BACKEND_URL ?? "https://api.foreverfinds.shop",
    package: "scale",
  })
  logger.info(
    `[platform] Forever Finds registered: tenant=${res.tenant_id} domain=${res.domain} data_tenant=${res.data_tenant}`
  )

  // control-plane wallet + matching grant (idempotent)
  const wallets = await svc.listCreditWallets(
    { tenant_id: res.tenant_id },
    { take: 1 }
  )
  if (!wallets?.length) {
    await svc.createCreditWallets([
      { tenant_id: res.tenant_id, balance: SCALE_CREDITS, reserved: 0 },
    ])
    await svc.createCreditTransactions([
      {
        tenant_id: res.tenant_id,
        type: "grant",
        amount: SCALE_CREDITS,
        balance_after: SCALE_CREDITS,
        idempotency_key: "ff-initial-grant",
        action: "initial_grant",
      },
    ])
    await svc.updateTenants({
      id: res.tenant_id,
      credit_balance: SCALE_CREDITS,
    })
    logger.info(`[platform] Forever Finds wallet seeded: ${SCALE_CREDITS} credits`)
  } else {
    logger.info(`[platform] Forever Finds wallet already exists — skipped`)
  }

  const all = await svc.listTenants({ slug: FF_SLUG })
  logger.info(`[platform] tenants now: ${all?.length ?? 0}`)
}
