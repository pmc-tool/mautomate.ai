#!/usr/bin/env node
/**
 * Probe: be-campaigns
 *
 * Proves, against the INSTALLED @medusajs dist (not the develop checkout):
 *  1. Campaign model has NO metadata field -> metadata.tenant_id isolation is
 *     IMPOSSIBLE for campaigns; campaign_identifier exists and carries a unique
 *     index -> "<tenantId>:<identifier>" namespacing is the chosen mechanism.
 *  2. Promotion model DOES have metadata (promotion rows keep metadata.tenant_id).
 *  3. CampaignBudget model exposes type/currency_code/limit/used/attribute
 *     (budget used/limit reporting fields used by the routes).
 *  4. Every workflow the routes call is exported by @medusajs/core-flows.
 *  5. Every promotion-module service method the routes call exists.
 *  6. CampaignBudgetType enum values used by the zod schemas exist.
 */
const fs = require("fs")
const path = require("path")

const CANDIDATE_ROOTS = [
  process.env.PROBE_APP_DIR,
  "/Users/nowshidalamsayem/Desktop/CLAUDE/my-store/apps/backend",
  "/opt/foreverfinds/app/apps/backend",
  process.cwd(),
].filter(Boolean)

function resolveFrom(pkg) {
  for (const root of CANDIDATE_ROOTS) {
    try {
      return require.resolve(pkg, { paths: [root] })
    } catch (e) {
      /* try next root */
    }
  }
  throw new Error(`cannot resolve ${pkg} from any of: ${CANDIDATE_ROOTS.join(", ")}`)
}

let failures = 0
function check(name, fn) {
  try {
    const detail = fn()
    console.log(`PASS  ${name}${detail ? ` (${detail})` : ""}`)
  } catch (e) {
    failures++
    console.error(`FAIL  ${name}: ${e.message}`)
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

// ---- 1 + 2 + 3: model sources -------------------------------------------------
const promotionPkgDir = path.dirname(resolveFrom("@medusajs/promotion/package.json"))
const campaignSrc = fs.readFileSync(path.join(promotionPkgDir, "dist/models/campaign.js"), "utf8")
const budgetSrc = fs.readFileSync(path.join(promotionPkgDir, "dist/models/campaign-budget.js"), "utf8")
const promotionSrc = fs.readFileSync(path.join(promotionPkgDir, "dist/models/promotion.js"), "utf8")

check("Campaign model has campaign_identifier (isolation field)", () => {
  assert(/campaign_identifier:/.test(campaignSrc), "campaign_identifier missing on Campaign model")
})
check("Campaign campaign_identifier has a unique index (namespacing is collision-safe)", () => {
  assert(
    /on:\s*\[\s*["']campaign_identifier["']\s*\]/.test(campaignSrc) && /unique:\s*true/.test(campaignSrc),
    "unique index on campaign_identifier not found"
  )
})
check("Campaign model does NOT support metadata (=> namespacing, not metadata.tenant_id)", () => {
  assert(!/metadata\s*:/.test(campaignSrc), "Campaign unexpectedly HAS metadata; isolation choice invalid")
})
check("Campaign model fields used by routes: name/description/starts_at/ends_at/budget/promotions", () => {
  for (const f of ["name:", "description:", "starts_at:", "ends_at:", "budget:", "promotions:"]) {
    assert(campaignSrc.includes(f), `Campaign field ${f} missing`)
  }
})
check("CampaignBudget fields used for budget reporting: type/currency_code/limit/used/attribute", () => {
  for (const f of ["type:", "currency_code:", "limit:", "used:", "attribute:"]) {
    assert(budgetSrc.includes(f), `CampaignBudget field ${f} missing`)
  }
})
check("Promotion model HAS metadata (promotion rows stay metadata.tenant_id-tagged)", () => {
  assert(/metadata\s*:/.test(promotionSrc), "Promotion.metadata missing")
})
check("Promotion model has campaign relation + application_method (ownership + currency checks)", () => {
  assert(/campaign\s*:/.test(promotionSrc), "Promotion.campaign missing")
  assert(/application_method\s*:/.test(promotionSrc), "Promotion.application_method missing")
})

// ---- 4: core-flows workflow exports ------------------------------------------
check("core-flows exports all campaign workflows", () => {
  const flows = require(resolveFrom("@medusajs/core-flows"))
  const needed = [
    "createCampaignsWorkflow",
    "updateCampaignsWorkflow",
    "deleteCampaignsWorkflow",
    "addOrRemoveCampaignPromotionsWorkflow",
  ]
  for (const name of needed) {
    assert(typeof flows[name] === "function", `${name} not exported`)
  }
  return needed.join(", ")
})

// ---- 5: promotion module service methods --------------------------------------
check("promotion module service has campaign methods used by routes", () => {
  const mod = require(path.join(promotionPkgDir, "dist/services/promotion-module.js"))
  const Service = mod.default || mod.PromotionModuleService
  assert(Service && Service.prototype, "PromotionModuleService not loadable")
  const needed = [
    "listCampaigns",
    "listAndCountCampaigns",
    "retrieveCampaign",
    "listPromotions",
    "addPromotionsToCampaign",
    "removePromotionsFromCampaign",
  ]
  const proto = Service.prototype
  for (const name of needed) {
    assert(typeof proto[name] === "function", `service.${name} missing`)
  }
  return needed.join(", ")
})

// ---- 6: CampaignBudgetType enum -----------------------------------------------
check("CampaignBudgetType enum has spend/usage/use_by_attribute", () => {
  const utils = require(resolveFrom("@medusajs/utils"))
  const t = utils.CampaignBudgetType || (utils.PromotionUtils && utils.PromotionUtils.CampaignBudgetType)
  assert(t, "CampaignBudgetType not exported")
  assert(t.SPEND === "spend", "SPEND !== spend")
  assert(t.USAGE === "usage", "USAGE !== usage")
  assert(t.USE_BY_ATTRIBUTE === "use_by_attribute", "USE_BY_ATTRIBUTE missing")
})

if (failures > 0) {
  console.error(`\n${failures} probe check(s) FAILED`)
  process.exit(1)
}
console.log("\nAll be-campaigns probe checks passed.")