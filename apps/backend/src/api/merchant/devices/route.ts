import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { resolveMerchant } from "../_helpers"

/** Normalize a MedusaService create/update result to a single row. */
function one<T>(res: T | T[]): T {
  return Array.isArray(res) ? res[0] : res
}

/** The device fields safe to return to the client. */
function publicDevice(d: any) {
  return {
    id: d.id,
    platform: d.platform,
    app_version: d.app_version ?? null,
    device_name: d.device_name ?? null,
    last_seen_at: d.last_seen_at ?? null,
    created_at: d.created_at ?? null,
  }
}

/**
 * GET /merchant/devices
 * List the signed-in merchant's registered push devices. Scoped to the caller
 * (merchant_id from the session), so a merchant only ever sees their own.
 *
 * Response: { devices }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) {
    return res.status(401).json({ message: "not authorized" })
  }

  const devices: any[] = await ctx.svc
    .listMerchantDevices(
      { tenant_id: ctx.tenant.id, merchant_id: ctx.merchant.id },
      { take: 100, order: { created_at: "DESC" } }
    )
    .catch(() => [])

  res.json({ devices: devices.map(publicDevice) })
}

type RegisterBody = {
  token?: string
  platform?: "android" | "ios"
  app_version?: string | null
  device_name?: string | null
}

/**
 * POST /merchant/devices
 * Register (or refresh) an FCM device token for the signed-in merchant. Called
 * by the mAutomate app right after sign-in and again on every token refresh.
 *
 * UPSERT BY TOKEN: a physical device has exactly one FCM token, so we key on it.
 * Re-registering an existing token re-points it to the current signed-in
 * merchant + tenant and bumps last_seen_at — correct when a device is shared or
 * a token is refreshed. tenant_id + merchant_id ALWAYS come from the session
 * (resolveMerchant), NEVER from the body, so a device can only bind to the
 * caller's own tenant.
 *
 * Body: { token (required), platform?, app_version?, device_name? }
 * Response: { device }
 */
export const POST = async (
  req: MedusaRequest<RegisterBody>,
  res: MedusaResponse
) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) {
    return res.status(401).json({ message: "not authorized" })
  }

  const body = req.body ?? {}
  const token = (body.token ?? "").trim()
  if (!token) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "`token` is required to register a device for push notifications."
    )
  }

  const platform = body.platform === "ios" ? "ios" : "android"

  const fields = {
    tenant_id: ctx.tenant.id as string,
    merchant_id: ctx.merchant.id as string,
    token,
    platform,
    app_version: body.app_version ?? null,
    device_name: body.device_name ?? null,
    last_seen_at: new Date(),
  }

  const existing = (
    await ctx.svc.listMerchantDevices({ token }, { take: 1 }).catch(() => [])
  )[0]

  const device = existing
    ? one(await ctx.svc.updateMerchantDevices({ id: existing.id, ...fields }))
    : one(await ctx.svc.createMerchantDevices(fields))

  res.status(existing ? 200 : 201).json({ device: publicDevice(device) })
}
