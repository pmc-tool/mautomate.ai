import { model } from "@medusajs/framework/utils"

/**
 * mobile_app_order — one merchant request in the white-label shopper-app
 * pipeline. Two kinds share the table:
 *
 *   kind = "build"    a self-serve request to build the branded APK/AAB from the
 *                     tenant's current app config. Fulfilled async by ops (the
 *                     factory script), never in the request handler.
 *   kind = "publish"  a PAID done-for-you Play/App Store publishing service. The
 *                     order is created in `awaiting_payment`; it only becomes
 *                     `paid` when the Stripe webhook confirms the money arrived
 *                     AND the paid amount matches the server-side tier price.
 *
 * This lives in the control-plane (platform module). `tenant_id` scopes every
 * row to one store; `stripe_event_id` makes webhook fulfilment idempotent.
 */
const MobileAppOrder = model
  .define("mobile_app_order", {
    id: model.id({ prefix: "maorder" }).primaryKey(),
    tenant_id: model.text(),
    kind: model.enum(["build", "publish"]),
    // publish only: which tier was bought + the money trail
    tier: model.text().nullable(), // "play" | "full"
    regular_price_usd: model.number().nullable(),
    expected_amount_usd: model.number().nullable(), // server-derived at creation
    amount_paid_usd: model.number().nullable(), // Stripe-VERIFIED charged amount
    // build|publish lifecycle status (text: values differ per kind)
    //   build:   queued | building | ready | failed
    //   publish: awaiting_payment | paid | in_progress | published | cancelled | payment_mismatch
    status: model.text().default("queued"),
    // build only: a ready artifact the merchant can download
    download_url: model.text().nullable(),
    // idempotency: one Stripe event can fulfil an order at most once
    stripe_event_id: model.text().nullable(),
    // snapshot of the app branding at request time (build) / order meta (publish)
    config_snapshot: model.json().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_mobile_app_order_tenant",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_mobile_app_order_kind",
      on: ["tenant_id", "kind"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MobileAppOrder
