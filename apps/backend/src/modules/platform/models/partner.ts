import { model } from "@medusajs/framework/utils"
/** partner — an agency/reseller account (the partner program). */
const Partner = model.define("partner", {
  id: model.id({ prefix: "prt" }).primaryKey(),
  name: model.text(),
  email: model.text().nullable(),
  company: model.text().nullable(),
  tier: model.enum(["bronze", "silver", "gold"]).default("bronze"),
  commission_pct: model.number().default(20),
  status: model.enum(["active", "inactive"]).default("active"),
  referral_code: model.text().nullable(),
}).indexes([{ name: "IDX_partner_status", on: ["status"], unique: false, where: "deleted_at IS NULL" }])
export default Partner
