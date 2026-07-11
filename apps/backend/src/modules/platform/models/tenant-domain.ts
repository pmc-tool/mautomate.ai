import { model } from "@medusajs/framework/utils"

/**
 * tenant_domain — a hostname routed to a tenant's store.
 *
 * `type=free` is a `<slug>.mautomate.ai` wildcard subdomain (instant).
 * `type=custom` is a merchant domain fronted by Cloudflare for SaaS: the
 * `cf_hostname_id` is the Custom Hostname id, `ssl_status` mirrors the async
 * cert lifecycle, and `verification_status` tracks DCV/CNAME ownership. The
 * control-plane router reads (domain -> tenant) from here (cached).
 */
const TenantDomain = model
  .define("tenant_domain", {
    id: model.id({ prefix: "tdom" }).primaryKey(),
    tenant_id: model.text(),
    domain: model.text(),
    type: model.enum(["free", "custom"]).default("free"),
    is_primary: model.boolean().default(false),
    cf_hostname_id: model.text().nullable(),
    ssl_status: model
      .enum(["pending", "active", "failed"])
      .default("pending"),
    verification_status: model
      .enum(["pending", "verified", "failed"])
      .default("pending"),
    verification: model.json().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_tenant_domain_unique",
      on: ["domain"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_tenant_domain_tenant",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default TenantDomain
