import { model } from "@medusajs/framework/utils"

/**
 * tenant — the control-plane record for one mAutomate customer store.
 *
 * This lives in the CONTROL PLANE (the platform module), not inside a tenant's
 * isolated backend. It is the routing + lifecycle + billing anchor:
 *   - `slug`            the free-subdomain label + internal handle (unique)
 *   - instance pointer  `db_name` / `backend_url` / `container_ref` / `region`
 *   - `publishable_key` ties every storefront request for this tenant to its store
 *   - `credit_balance`  a DERIVED CACHE of the authoritative credit ledger
 *                       (credit_transaction). Never the source of truth; stored
 *                       as bigNumber so it is exact, never a float.
 *   - lifecycle `status` drives the billing/suspension state machine.
 */
const Tenant = model
  .define("tenant", {
    id: model.id({ prefix: "ten" }).primaryKey(),
    slug: model.text(),
    name: model.text(),
    package: model
      .enum(["free_trial", "starter", "growth", "pro", "scale"])
      .default("free_trial"),
    status: model
      .enum([
        "provisioning",
        "live",
        "past_due",
        "grace",
        "suspended",
        "retained",
        "purged",
        "failed",
      ])
      .default("provisioning"),
    billing_country: model.text().nullable(),
    // instance pointer (populated by the provisioning saga)
    db_name: model.text().nullable(),
    backend_url: model.text().nullable(),
    container_ref: model.text().nullable(),
    region: model.text().nullable(),
    publishable_key: model.text().nullable(),
    // billing / credits (balance is a derived cache of the ledger)
    credit_balance: model.bigNumber().default(0),
    trial_ends_at: model.dateTime().nullable(),
    suspended_at: model.dateTime().nullable(),
    retained_until: model.dateTime().nullable(),
    provisioned_at: model.dateTime().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_tenant_slug_unique",
      on: ["slug"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_tenant_status",
      on: ["status"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default Tenant
