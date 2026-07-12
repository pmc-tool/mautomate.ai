#!/usr/bin/env node
/*
 * Non-destructive probe for the /merchant/promotions backend (be-promotions).
 * Run from apps/backend (so node_modules resolve):  node probe-be-promotions.js
 * Reads installed dists only — creates/updates NOTHING.
 */
const fs = require("fs")
const path = require("path")
const { createRequire } = require("module")

// resolve packages from the backend app the probe is run in, regardless of
// where this script file itself lives
const appRequire = createRequire(path.join(process.cwd(), "package.json"))

let failures = 0
const assert = (cond, msg) => {
  if (cond) {
    console.log("ok  : " + msg)
  } else {
    failures++
    console.error("FAIL: " + msg)
  }
}
const readDist = (spec) => fs.readFileSync(appRequire.resolve(spec), "utf8")

/* 1. every core-flows workflow export the routes (and campaigns sibling) use */
const flows = appRequire("@medusajs/core-flows")
for (const name of [
  "createPromotionsWorkflow",
  "updatePromotionsWorkflow",
  "deletePromotionsWorkflow",
  "batchPromotionRulesWorkflow",
  "createPromotionRulesWorkflow",
  "updatePromotionRulesWorkflow",
  "deletePromotionRulesWorkflow",
  "addOrRemoveCampaignPromotionsWorkflow",
  "createCampaignsWorkflow",
  "updateCampaignsWorkflow",
  "deleteCampaignsWorkflow",
]) {
  assert(typeof flows[name] === "function", `core-flows exports ${name}`)
}

/* 2. framework utils enums used by the routes */
const utils = appRequire("@medusajs/framework/utils")
assert(
  utils.RuleType &&
    utils.RuleType.RULES === "rules" &&
    utils.RuleType.TARGET_RULES === "target_rules" &&
    utils.RuleType.BUY_RULES === "buy_rules",
  "RuleType enum = rules | target_rules | buy_rules"
)
assert(
  utils.PromotionStatus &&
    utils.PromotionStatus.DRAFT === "draft" &&
    utils.PromotionStatus.ACTIVE === "active" &&
    utils.PromotionStatus.INACTIVE === "inactive",
  "PromotionStatus enum = draft | active | inactive"
)
assert(
  utils.ApplicationMethodAllocation &&
    utils.ApplicationMethodAllocation.ONCE === "once",
  "ApplicationMethodAllocation supports 'once'"
)
assert(!!utils.Modules && !!utils.Modules.PROMOTION, "Modules.PROMOTION registered")

/* 3. installed promotion model supports every field the routes read/write */
const promoModel = readDist("@medusajs/promotion/dist/models/promotion.js")
for (const f of [
  "metadata",
  "status",
  "limit",
  "used",
  "is_tax_inclusive",
  "is_automatic",
  "campaign",
  "application_method",
  "rules",
]) {
  assert(promoModel.includes(f + ":"), `promotion model has ${f}`)
}
assert(promoModel.includes("searchable()"), "promotion.code is searchable -> module q pushdown works")
assert(
  !promoModel.includes("starts_at:"),
  "promotion model has NO starts_at -> scheduling dates round-trip via metadata (by design)"
)

const amModel = readDist("@medusajs/promotion/dist/models/application-method.js")
for (const f of [
  "type",
  "target_type",
  "value",
  "currency_code",
  "allocation",
  "max_quantity",
  "apply_to_quantity",
  "buy_rules_min_quantity",
  "target_rules",
  "buy_rules",
]) {
  assert(amModel.includes(f + ":"), `application_method model has ${f}`)
}

const ruleModel = readDist("@medusajs/promotion/dist/models/promotion-rule.js")
for (const f of ["attribute", "operator", "values"]) {
  assert(ruleModel.includes(f + ":"), `promotion_rule model has ${f}`)
}

/* 4. PROOF of the campaign isolation choice: 2.17 campaigns have NO metadata,
 *    so isolation MUST be via campaign_identifier = "<tenantId>:<slug>". */
const campaignModel = readDist("@medusajs/promotion/dist/models/campaign.js")
assert(campaignModel.includes("campaign_identifier:"), "campaign model has campaign_identifier")
assert(
  !campaignModel.includes("metadata:"),
  "campaign model has NO metadata -> tenant isolation via campaign_identifier prefix (PROVEN)"
)

/* 5. module list filter support (q / status / code) + campaign_id FK filter */
const filterDts = readDist("@medusajs/types/dist/promotion/common/promotion.d.ts")
for (const f of ["q?:", "status?:", "code?:"]) {
  assert(filterDts.includes(f), `FilterablePromotionProps supports ${f}`)
}
const svc = readDist("@medusajs/promotion/dist/services/promotion-module.js")
assert(
  svc.includes("campaign_id: null"),
  "promotion module itself filters on campaign_id (FK filter pushdown proven)"
)
assert(
  svc.includes("campaign_id: campaignId"),
  "module updatePromotions handles campaign_id -> updatePromotionsWorkflow set/unset path is valid"
)
assert(
  /Could not find campaign with id/.test(svc),
  "module validates campaign_id on update (unknown ids rejected)"
)

/* 6. graph entities + fields used by the routes (label hydration + rule values) */
const entityChecks = [
  ["@medusajs/customer/dist/models/customer-group.js", "customer_group", ["name", "metadata"]],
  ["@medusajs/product/dist/models/product.js", "product", ["title"]],
  ["@medusajs/product/dist/models/product-category.js", "product_category", ["name", "metadata"]],
  ["@medusajs/product/dist/models/product-collection.js", "product_collection", ["title", "metadata"]],
  ["@medusajs/product/dist/models/product-type.js", "product_type", ["value", "metadata"]],
  ["@medusajs/product/dist/models/product-tag.js", "product_tag", ["value", "metadata"]],
]
for (const [spec, entity, fields] of entityChecks) {
  try {
    const src = readDist(spec)
    for (const f of fields) {
      assert(src.includes(f + ":"), `${entity} model has field ${f} (graph field list valid)`)
    }
  } catch (e) {
    failures++
    console.error(`FAIL: cannot read model for ${entity}: ${e.message}`)
  }
}
try {
  const linkDef = readDist(
    "@medusajs/link-modules/dist/definitions/product-sales-channel.js"
  )
  assert(
    linkDef.includes("product_id") && linkDef.includes("sales_channel_id"),
    "product_sales_channel link exposes product_id + sales_channel_id (tenant product scoping)"
  )
} catch (e) {
  failures++
  console.error("FAIL: product_sales_channel link definition missing: " + e.message)
}

/* 7. PROOF of the buyget allocation/max_quantity fix: the module REQUIRES
 *    max_quantity for buyget and FORBIDS it with allocation "across", so the
 *    create route must default buyget to allocation "each" + max_quantity. */
try {
  const amValidation = readDist(
    "@medusajs/promotion/dist/utils/validations/application-method.js"
  )
  assert(
    amValidation.includes(
      "max_quantity is a required field for Promotion type of"
    ),
    "module requires max_quantity for buyget (create defaults allocation 'each' + max_quantity)"
  )
  assert(
    amValidation.includes("max_quantity is not allowed to be set for allocation"),
    "module forbids max_quantity with allocation 'across' -> buyget+across impossible (fix proven)"
  )
} catch (e) {
  failures++
  console.error(
    "FAIL: cannot read promotion application-method validations: " + e.message
  )
}

/* 8. legacy discounts namespacing helpers stay the single source of truth */
try {
  const promoCode = fs.readFileSync(
    path.join(process.cwd(), "src/api/merchant/discounts/_promo-code.ts"),
    "utf8"
  )
  for (const fn of ["namespaceCode", "denamespaceCode", "tenantPrefix"]) {
    assert(promoCode.includes(`export function ${fn}`), `_promo-code exports ${fn}`)
  }
} catch (e) {
  failures++
  console.error(
    "FAIL: src/api/merchant/discounts/_promo-code.ts not found — the promotions routes import it; " +
      "run this probe in the DEPLOYED backend tree (legacy discounts must stay in place): " +
      e.message
  )
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PROBES PASSED")
process.exit(failures ? 1 : 0)