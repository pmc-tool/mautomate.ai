import {
  StepResponse,
  WorkflowData,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"

import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PLATFORM_MODULE } from "../../modules/platform"
import { EncryptedConfigService } from "../../modules/platform/secure-config"
import { getLedger } from "../../modules/platform/credits/metering"
import { bootstrapTenantStoreWorkflow } from "../platform/bootstrap-tenant-store"
import { ensureStarterCmsContent } from "../../modules/cms/starter-pages"

export type ProvisionTenantInput = {
  slug: string
  name: string
  package?: string
  billing_country?: string
  secrets?: Record<string, string>
  trial_credits?: number
}

const createTenantStep = createStep(
  "provision-create-tenant",
  async (input: ProvisionTenantInput, { container }) => {
    const svc = container.resolve(PLATFORM_MODULE) as any
    const [tenant] = await svc.createTenants([
      {
        slug: input.slug,
        name: input.name,
        package: input.package ?? "free_trial",
        billing_country: input.billing_country ?? null,
        status: "provisioning",
      },
    ])
    return new StepResponse(tenant, tenant.id)
  },
  async (tenantId, { container }) => {
    if (!tenantId) return
    const svc = container.resolve(PLATFORM_MODULE) as any
    await svc.deleteTenants([tenantId])
  }
)

const bootstrapTenantStoreStep = createStep(
  "provision-bootstrap-store",
  async (tenant: any, { container }) => {
    const { result } = await bootstrapTenantStoreWorkflow(container).run({
      input: { tenant },
      throwOnError: true,
    })
    return new StepResponse(result, {
      sales_channel_id: result.sales_channel_id,
      api_key_id: result.api_key_id,
      product_id: result.sample_product_id,
    })
  },
  async (comp, { container }) => {
    if (!comp) return
    try {
      const sc: any = container.resolve("salesChannel")
      await sc.deleteSalesChannels([comp.sales_channel_id])
    } catch {}
    try {
      const ak: any = container.resolve("apiKey")
      await ak.deleteApiKeys([comp.api_key_id])
    } catch {}
  }
)

const seedCmsStep = createStep(
  "provision-seed-cms",
  async (tenant: any, { container }) => {
    // Best-effort: seed this tenant's OWN starter pages + chrome so a new store
    // starts complete instead of falling back to inline defaults. Never blocks
    // provisioning — a CMS seed failure is logged and swallowed.
    try {
      await ensureStarterCmsContent(container, tenant.id)
    } catch (e) {
      const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
      logger.error(
        `[cms] starter content seed failed for tenant ${tenant.id}: ${
          (e as Error).message
        }`
      )
    }
    return new StepResponse(tenant, null)
  }
)

const seedSecretsStep = createStep(
  "provision-seed-secrets",
  async (
    input: { tenant: any; secrets?: Record<string, string> },
    { container }
  ) => {
    const cfg = new EncryptedConfigService(container)
    await cfg.ensureKey(input.tenant.id)
    for (const [k, v] of Object.entries(input.secrets ?? {})) {
      await cfg.setSecret(input.tenant.id, k, v)
    }
    return new StepResponse(input.tenant, {
      tenant_id: input.tenant.id,
      keys: Object.keys(input.secrets ?? {}),
    })
  },
  async (comp, { container }) => {
    if (!comp) return
    const svc = container.resolve(PLATFORM_MODULE) as any
    const rows = await svc.listTenantConfigs({ tenant_id: comp.tenant_id })
    if (rows?.length) {
      await svc.deleteTenantConfigs(rows.map((r: any) => r.id))
    }
  }
)

const allocateHostnameStep = createStep(
  "provision-allocate-hostname",
  async (tenant: any, { container }) => {
    const svc = container.resolve(PLATFORM_MODULE) as any
    const base = process.env.PLATFORM_ROOT_DOMAIN ?? "mautomate.ai"
    const domain = `${tenant.slug}.${base}`.toLowerCase()
    const [row] = await svc.createTenantDomains([
      {
        tenant_id: tenant.id,
        domain,
        type: "free",
        is_primary: true,
        ssl_status: "active",
        verification_status: "verified",
      },
    ])
    return new StepResponse({ ...tenant, domain }, row.id)
  },
  async (domainId, { container }) => {
    if (!domainId) return
    const svc = container.resolve(PLATFORM_MODULE) as any
    await svc.deleteTenantDomains([domainId])
  }
)

const allocateTrialCreditsStep = createStep(
  "provision-allocate-trial-credits",
  async (
    input: { tenant: any; trial_credits?: number },
    { container }
  ) => {
    const svc = container.resolve(PLATFORM_MODULE) as any
    const credits = input.trial_credits ?? 300
    if (credits > 0) {
      await getLedger(container).credit(input.tenant.id, credits, {
        type: "grant",
        idempotencyKey: `trial_grant_${input.tenant.id}`,
      })
    }
    await svc.updateTenants({ id: input.tenant.id, credit_balance: credits })
    return new StepResponse(input.tenant, {
      tenant_id: input.tenant.id,
      credits,
    })
  },
  async (comp, { container }) => {
    if (!comp) return
    if (comp.credits > 0) {
      await getLedger(container)
        .clawback(comp.tenant_id, comp.credits, {
          idempotencyKey: `trial_grant_rollback_${comp.tenant_id}`,
        })
        .catch(() => undefined)
    }
    const svc = container.resolve(PLATFORM_MODULE) as any
    await svc.updateTenants({ id: comp.tenant_id, credit_balance: 0 })
  }
)

const markLiveStep = createStep(
  "provision-mark-live",
  async (tenant: any, { container }) => {
    const svc = container.resolve(PLATFORM_MODULE) as any
    await svc.updateTenants({
      id: tenant.id,
      status: "live",
      provisioned_at: new Date(),
    })
    return new StepResponse({ tenant_id: tenant.id, status: "live" }, tenant.id)
  },
  async (tenantId, { container }) => {
    if (!tenantId) return
    const svc = container.resolve(PLATFORM_MODULE) as any
    await svc.updateTenants({ id: tenantId, status: "provisioning" })
  }
)

export const provisionTenantWorkflow = createWorkflow(
  "platform-provision-tenant",
  (input: WorkflowData<ProvisionTenantInput>) => {
    const tenant = createTenantStep(input)
    const bootstrapped = bootstrapTenantStoreStep(tenant)
    const cmsSeeded = seedCmsStep(bootstrapped)
    const seeded = seedSecretsStep({ tenant: cmsSeeded, secrets: input.secrets })
    const hosted = allocateHostnameStep(seeded)
    const credited = allocateTrialCreditsStep({
      tenant: hosted,
      trial_credits: input.trial_credits,
    })
    const live = markLiveStep(credited)
    return new WorkflowResponse(live)
  }
)

export default provisionTenantWorkflow
