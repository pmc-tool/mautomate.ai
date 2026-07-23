import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../_helpers"
import { PLATFORM_MODULE } from "../../../../modules/platform"
import { bundleIdForSlug } from "../../../../modules/platform/mobile-app/prices"

/**
 * GET/POST /merchant/mobile-app/build-request
 *
 * Self-serve request to build the branded shopper-app binary from the tenant's
 * current app config. This does NOT run flutter here — the factory build is an
 * async ops job (mirrors how domain/provisioning work is recorded, not executed,
 * in the request handler). We record a queued order and log an ops signal. If a
 * build artifact already exists for this store, its download_url is surfaced.
 *
 * The `mobile_app_order` record is the SOURCE OF TRUTH for the pipeline, surfaced
 * to ops by the super-admin page /admin/platform/mobile-app-orders. We no longer
 * open a support ticket for these (they are not a support conversation); a
 * lightweight audit_log row is the ops signal instead.
 *
 * Tenant-scoped + fail-closed via resolveMerchant.
 */

const latest = async (platform: any, tenantId: string) => {
  const rows = await platform
    .listMobileAppOrders(
      { tenant_id: tenantId, kind: "build" },
      { take: 20, order: { created_at: "DESC" } }
    )
    .catch(() => [])
  return rows ?? []
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const platform: any = req.scope.resolve(PLATFORM_MODULE)
  const rows = await latest(platform, ctx.tenant.id)
  const withArtifact = rows.find((r: any) => r.download_url)

  res.json({
    requests: rows.map((r: any) => ({
      request_id: r.id,
      status: r.status,
      download_url: r.download_url ?? null,
      created_at: r.created_at,
    })),
    latest_status: rows[0]?.status ?? null,
    download_url: withArtifact?.download_url ?? null,
  })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const stored = ((ctx.tenant.meta ?? {}) as any).app_config ?? {}
  const appName = String(stored.app_name ?? ctx.tenant.name ?? "").trim()
  if (!appName) {
    return res.status(400).json({
      message: "Configure your app (at least an app name) before requesting a build.",
    })
  }

  const platform: any = req.scope.resolve(PLATFORM_MODULE)
  const bundleId = bundleIdForSlug(ctx.tenant.slug)

  // Snapshot the branding + the per-store binding the factory needs, so an ops
  // build is reproducible even if the merchant edits the config afterwards.
  const config_snapshot = {
    slug: ctx.tenant.slug,
    app_name: appName,
    icon_url: stored.icon_url ?? ((ctx.tenant.meta ?? {}) as any).logo_url ?? null,
    accent_color: stored.accent_color ?? null,
    android_bundle_id: bundleId,
    ios_bundle_id: stored.ios_bundle_id ?? bundleId,
    publishable_key: ctx.tenant.publishable_key ?? null,
    tenant_id: ctx.tenant.id,
  }

  const [order] = await platform.createMobileAppOrders([
    {
      tenant_id: ctx.tenant.id,
      kind: "build",
      status: "queued",
      config_snapshot,
      meta: { requested_by: ctx.merchant.id },
    },
  ])

  // Ops signal (no support ticket — the mobile_app_order surfaced by
  // /admin/platform/mobile-app-orders is the source of truth). A lightweight
  // audit_log row records the request for the ops trail.
  await platform
    .createAuditLogs([
      {
        actor: "system",
        action: "mobile_app.build.requested",
        tenant_id: ctx.tenant.id,
        outcome: "success",
        meta: {
          order_id: order.id,
          slug: ctx.tenant.slug,
          app_name: appName,
          requested_by: ctx.merchant.id,
        },
      },
    ])
    .catch(() => undefined)

  // Surface an existing artifact if we already have one for this store.
  const prior = (await latest(platform, ctx.tenant.id)).find((r: any) => r.download_url)

  res.status(201).json({
    request_id: order.id,
    status: order.status,
    download_url: prior?.download_url ?? null,
  })
}
