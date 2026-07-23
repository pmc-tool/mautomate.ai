import { model } from "@medusajs/framework/utils"

/**
 * merchant_device — a single push-notification target for a merchant user.
 *
 * One row per physical device (keyed by its FCM registration token). Registered
 * by the mAutomate merchant app after sign-in via POST /merchant/devices and
 * removed on sign-out. The push notifier (modules/platform/push/push-notifier)
 * looks these up by tenant_id + merchant_id to fan a notification out to every
 * device a merchant has signed in on.
 *
 * TENANCY: tenant_id + merchant_id are always taken from the authenticated
 * merchant session (resolveMerchant), NEVER from the request body — a device
 * can only ever be bound to the caller's own tenant. The token is globally
 * unique (a physical device has exactly one FCM token); re-registering an
 * existing token simply re-points it to the current signed-in merchant, which
 * is correct when a device is handed between accounts.
 */
const MerchantDevice = model
  .define("merchant_device", {
    id: model.id({ prefix: "mdev" }).primaryKey(),
    tenant_id: model.text(),
    merchant_id: model.text(),
    // The FCM registration token for this install (opaque, device-unique).
    token: model.text(),
    platform: model.enum(["android", "ios"]).default("android"),
    // Optional client hints for debugging / stale-device pruning.
    app_version: model.text().nullable(),
    device_name: model.text().nullable(),
    last_seen_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_merchant_device_token_unique",
      on: ["token"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_merchant_device_merchant",
      on: ["merchant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_merchant_device_tenant",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MerchantDevice
