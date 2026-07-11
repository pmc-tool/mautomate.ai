import { model } from "@medusajs/framework/utils"

/**
 * domain — a domain registered, transferred, or managed through the ResellerClub
 * integration. Local mirror of the registrar record: `reseller_order_id` links to
 * the ResellerClub order; DNS records / nameservers / privacy / lock are read
 * live from the registrar (not cached here), while lifecycle state + key dates
 * are mirrored for listing and expiry logic.
 *
 * MULTI-TENANT (HaaS-ready): `tenant_id` scopes every row; unique per
 * (tenant_id, domain_name).
 */
const DomainModel = model
  .define("domain", {
    id: model.id({ prefix: "dom" }).primaryKey(),
    tenant_id: model.text(),
    domain_name: model.text(),
    tld: model.text().nullable(),
    status: model
      .enum([
        "active",
        "pending_register",
        "pending_transfer",
        "transferred_away",
        "expired",
        "failed",
        "cancelled",
      ])
      .default("pending_register"),
    source: model
      .enum(["registered", "transferred", "added_existing"])
      .default("registered"),
    reseller_order_id: model.text().nullable(),
    reseller_customer_id: model.text().nullable(),
    reseller_contact_id: model.text().nullable(),
    registration_date: model.dateTime().nullable(),
    expiry_date: model.dateTime().nullable(),
    auto_renew: model.boolean().default(false),
    privacy_enabled: model.boolean().default(false),
    locked: model.boolean().default(true),
    nameservers: model.json().nullable(),
    years: model.number().nullable(),
    register_price: model.number().nullable(),
    currency: model.text().nullable(),
    last_synced_at: model.dateTime().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_domain_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_domain_tenant_name_unique",
      on: ["tenant_id", "domain_name"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_domain_tenant_status",
      on: ["tenant_id", "status"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default DomainModel
