import { Modules } from "@medusajs/framework/utils"
import { MedusaError } from "@medusajs/framework/utils"
import { PLATFORM_MODULE } from "../modules/platform"

export default async function createTestMerchant({ container }: any) {
  const logger = container.resolve("logger")
  const svc: any = container.resolve(PLATFORM_MODULE)
  const authService: any = container.resolve(Modules.AUTH)

  const slug = process.env.TEST_TENANT_SLUG ?? "demo-store"
  const email = process.env.TEST_MERCHANT_EMAIL ?? "test-merchant@mautomate.ai"
  const password = process.env.TEST_MERCHANT_PASSWORD ?? "TestMerchant123!"
  const name = process.env.TEST_MERCHANT_NAME ?? "Test Merchant"

  const [tenant] = await svc.listTenants({ slug }, { take: 1 })
  if (!tenant) {
    logger.error(`Tenant ${slug} not found`)
    return { success: false, error: "tenant not found" }
  }

  const existing = await svc.listMerchants({ email }, { take: 1 })
  if (existing?.length) {
    logger.info(`Merchant ${email} already exists; skipping creation`)
    return { success: true, merchantId: existing[0].id, tenantId: tenant.id, email, existed: true }
  }

  const [merchant] = await svc.createMerchants([
    { tenant_id: tenant.id, email, name, status: "active" },
  ])

  try {
    const { authIdentity, error } = await authService.register("emailpass", { body: { email, password } })
    if (error || !authIdentity) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, typeof error === "string" ? error : "could not set password")
    }
    await authService.updateAuthIdentities({ id: authIdentity.id, app_metadata: { merchant_id: merchant.id, email } })
    logger.info(`Created test merchant ${email} for tenant ${tenant.id}`)
    return { success: true, merchantId: merchant.id, tenantId: tenant.id, email, existed: false }
  } catch (e: any) {
    await svc.deleteMerchants([merchant.id]).catch(() => {})
    logger.error(`Failed to create test merchant: ${e?.message || e}`)
    return { success: false, error: e?.message || String(e) }
  }
}
