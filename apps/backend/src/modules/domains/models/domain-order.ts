import { model } from "@medusajs/framework/utils"

/**
 * domain_order — an audit + async-tracking record for a registrar action
 * (register / transfer / renew / restore) against a domain. ResellerClub actions
 * are asynchronous (they return an action id + status that later resolves), so
 * this row captures the request, the reseller order/action ids, and the outcome.
 *
 * MULTI-TENANT (HaaS-ready): `tenant_id` scopes every row.
 */
const DomainOrder = model
  .define("domain_order", {
    id: model.id({ prefix: "dord" }).primaryKey(),
    tenant_id: model.text(),
    domain_name: model.text(),
    tld: model.text().nullable(),
    action: model.enum(["register", "transfer", "renew", "restore"]),
    years: model.number().nullable(),
    price: model.number().nullable(),
    currency: model.text().nullable(),
    status: model
      .enum(["pending", "processing", "success", "failed"])
      .default("pending"),
    reseller_order_id: model.text().nullable(),
    reseller_action_id: model.text().nullable(),
    reseller_status: model.text().nullable(),
    error: model.text().nullable(),
    created_by_user_id: model.text().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_domain_order_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_domain_order_tenant_domain",
      on: ["tenant_id", "domain_name"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default DomainOrder
