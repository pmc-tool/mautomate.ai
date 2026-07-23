import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { resolveMerchant } from "../../_helpers"

type UnregisterBody = { token?: string }

/**
 * POST /merchant/devices/unregister
 * Remove a device's FCM token on sign-out so a signed-out phone stops receiving
 * this merchant's notifications. The token is deleted only when it belongs to
 * the caller (merchant_id from the session), so one merchant can never remove
 * another's device binding.
 *
 * Uses a body token (not a path param) because FCM tokens contain characters
 * awkward in a URL segment. Idempotent: unknown/already-removed tokens still
 * return a clean deleted result.
 *
 * Body: { token (required) }
 * Response: { token, object: "merchant_device", deleted: true }
 */
export const POST = async (
  req: MedusaRequest<UnregisterBody>,
  res: MedusaResponse
) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) {
    return res.status(401).json({ message: "not authorized" })
  }

  const token = (req.body?.token ?? "").trim()
  if (!token) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "`token` is required to unregister a device."
    )
  }

  const existing = (
    await ctx.svc
      .listMerchantDevices(
        { token, merchant_id: ctx.merchant.id },
        { take: 1 }
      )
      .catch(() => [])
  )[0]

  if (existing) {
    await ctx.svc.softDeleteMerchantDevices(existing.id).catch(() => {})
  }

  res.json({ token, object: "merchant_device", deleted: true })
}
