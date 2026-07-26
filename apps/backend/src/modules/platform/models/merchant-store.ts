import { model } from "@medusajs/framework/utils"

/**
 * merchant_store — ownership link between a merchant login and a store
 * (tenant). Multi-store M0 (plan 2026-07-27): decouples the historical
 * one-login-one-store assumption. merchant.tenant_id REMAINS as the default
 * store pointer (which store opens on login); this table answers "which
 * stores may this login act on".
 *
 * TENANCY IRON RULE: store context is ONLY ever adopted after validating the
 * requested tenant against this table inside resolveMerchant — never from a
 * request body, never unvalidated. A row here is the sole grant of access.
 *
 * role is future-proofing for staff seats ("owner" today, always).
 */
const MerchantStore = model
  .define("merchant_store", {
    id: model.id({ prefix: "mstore" }).primaryKey(),
    merchant_id: model.text(),
    tenant_id: model.text(),
    role: model.text().default("owner"),
  })
  .indexes([
    {
      name: "IDX_merchant_store_unique",
      on: ["merchant_id", "tenant_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_merchant_store_merchant",
      on: ["merchant_id"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_merchant_store_tenant",
      on: ["tenant_id"],
      where: "deleted_at IS NULL",
    },
  ])

export default MerchantStore
