import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { resolveMerchant } from "../_helpers"
import { computeSetupStatus } from "../_setup"
import { syncStoreLogoToCms } from "../_cms-sync"

/**
 * GET / PATCH /merchant/setup
 *
 * The setup WIZARD's own state + the simple business fields it captures. This is
 * distinct from GET /merchant/setup/status (which is the verified completeness
 * picture): this route holds the merchant's answers and draft progress so the
 * wizard can be left and resumed exactly where it was, on any device.
 *
 * Draft state lives at tenant.meta.setup:
 *   { current_step, completed[], skipped[], answers, dismissed, started_at,
 *     completed_at }
 * The simple captured fields live at the top of tenant.meta so the rest of the
 * platform (storefront, shipping check, theme) can read them without knowing
 * about the wizard:  default_country, business{}, logo_url.  Currency is managed
 * through the existing /merchant/store/currencies route.
 */

const Draft = z
  .object({
    current_step: z.string().max(64).optional(),
    completed: z.array(z.string().max(64)).max(50).optional(),
    skipped: z.array(z.string().max(64)).max(50).optional(),
    answers: z.record(z.string(), z.any()).optional(),
    dismissed: z.boolean().optional(),
    started_at: z.string().max(40).optional(),
    completed_at: z.string().max(40).nullable().optional(),
  })
  .strict()

const Business = z
  .object({
    type: z.string().max(60).optional(),
    category: z.string().max(80).optional(),
    description: z.string().max(2000).optional(),
  })
  .strict()

const PatchSchema = z
  .object({
    draft: Draft.optional(),
    name: z.string().min(1).max(120).optional(),
    default_country: z.string().length(2).optional(),
    business: Business.optional(),
    logo_url: z.string().max(2000).nullable().optional(),
  })
  .strict()

function snapshot(tenant: any) {
  const meta = (tenant.meta ?? {}) as Record<string, any>
  return {
    name: tenant.name ?? "",
    default_country: String(meta.default_country || "").toLowerCase() || null,
    currency_code: (meta.currency_code || "usd").toLowerCase(),
    supported_currencies: Array.isArray(meta.supported_currencies)
      ? meta.supported_currencies
      : [(meta.currency_code || "usd").toLowerCase()],
    business: meta.business ?? {},
    logo_url: meta.logo_url ?? null,
    setup: meta.setup ?? {},
  }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const status = await computeSetupStatus(req, ctx)
  res.json({ ...snapshot(ctx.tenant), status })
}

export const PATCH = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = PatchSchema.safeParse(req.body)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }
  const body = parsed.data

  const meta = { ...((ctx.tenant.meta ?? {}) as Record<string, any>) }

  if (body.default_country !== undefined) {
    meta.default_country = body.default_country.toLowerCase()
    // The merchant has now explicitly confirmed their store country (vs the
    // value merely seeded at provisioning), so the "Confirm your store country"
    // setup task can tick.
    meta.country_confirmed = true
  }
  if (body.business !== undefined) {
    meta.business = { ...(meta.business ?? {}), ...body.business }
  }
  if (body.logo_url !== undefined) {
    // Explicit null clears it.
    if (body.logo_url === null || body.logo_url === "") delete meta.logo_url
    else meta.logo_url = body.logo_url
  }
  if (body.draft !== undefined) {
    meta.setup = { ...(meta.setup ?? {}), ...body.draft }
  }

  const update: any = { id: ctx.tenant.id, meta }
  if (body.name !== undefined) update.name = body.name.slice(0, 120)

  await ctx.svc.updateTenants(update)

  // A logo chosen here (e.g. an AI-generated one) must also land in the CMS
  // settings the storefront renders — not just tenant.meta.
  if (body.logo_url && typeof body.logo_url === "string") {
    await syncStoreLogoToCms(req.scope, ctx.tenant.id, body.logo_url)
  }

  // Re-read so the response reflects exactly what was persisted.
  const fresh = await ctx.svc.retrieveTenant(ctx.tenant.id).catch(() => ({
    ...ctx.tenant,
    meta,
    name: update.name ?? ctx.tenant.name,
  }))
  res.json(snapshot(fresh))
}
