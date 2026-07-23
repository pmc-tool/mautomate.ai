import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../_helpers"
import { getCommerceGateway } from "../../../../modules/marketing/gateway"
import { getAiTextProvider } from "../../../../modules/marketing/ai/registry"

/**
 * POST /merchant/ads/strategy — the AI Ad Strategist.
 *
 * Reads the store's REAL data (recent orders → where customers actually are;
 * catalog → what's being sold + price band) and returns a fully-reasoned
 * campaign the merchant can accept or tweak: objective, daily budget, target
 * countries, audience (age/gender), and a creative angle — each with a short,
 * evidence-based "why". When a decision genuinely needs the merchant (no sales
 * yet to infer a market, or budget unknown), it returns `questions` instead of
 * guessing. Nothing is fabricated: the country/product evidence is real; the AI
 * only reasons over it.
 *
 * Body (all optional): { budget_usd?, answers?: Record<string,string>, notes? }
 *   - budget_usd: the merchant's monthly ad budget, if they've said it
 *   - answers:    replies to a previous round's `questions` (the Q&A loop)
 */

const toNum = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Slice the first JSON object out of a model reply (tolerates code fences). */
const parseJson = (raw: string): Record<string, any> => {
  let t = String(raw ?? "").replace(/```(?:json)?/g, "")
  const a = t.indexOf("{")
  const b = t.lastIndexOf("}")
  if (a < 0 || b <= a) throw new Error("AI returned an unusable reply")
  t = t.slice(a, b + 1).replace(/,(\s*[}\]])/g, "$1") // tolerate trailing commas
  return JSON.parse(t)
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const body = (req.body ?? {}) as Record<string, any>
  const budgetUsd = toNum(body.budget_usd)
  const answers =
    body.answers && typeof body.answers === "object" ? body.answers : {}
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 500) : ""

  const tenantId = ctx.tenant.id
  const gateway = getCommerceGateway(req.scope)

  // ---- 1) Real evidence: where orders ship + what the store sells ----
  let orders: any[] = []
  let products: any[] = []
  try {
    orders = (await gateway.queryOrders(tenantId, { limit: 100 } as any)) ?? []
  } catch {
    orders = []
  }
  try {
    products = (await gateway.listProducts(tenantId, { limit: 40 } as any)) ?? []
  } catch {
    products = []
  }

  const countryTally: Record<string, number> = {}
  for (const o of orders) {
    const cc = o?.shipping_address?.country_code
    if (cc) {
      const k = String(cc).toUpperCase()
      countryTally[k] = (countryTally[k] || 0) + 1
    }
  }
  const topCountries = Object.entries(countryTally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({
      code,
      count,
      pct: Math.round((count / Math.max(1, orders.length)) * 100),
    }))

  const prices = products
    .map((p) => toNum(p?.price))
    .filter((n): n is number => n != null && n > 0)
  const priceBand = prices.length
    ? { min: Math.min(...prices), max: Math.max(...prices) }
    : null
  const productSample = products
    .slice(0, 12)
    .map((p) => String(p?.title ?? "").trim())
    .filter(Boolean)
  const categoryIds = Array.from(
    new Set(products.flatMap((p) => (p?.category_ids ?? []) as string[]))
  ).slice(0, 8)

  const hasSales = orders.length > 0
  const hasMarket = topCountries.length > 0

  // ---- 2) Ask the strategist to reason over the real evidence ----
  const provider = getAiTextProvider(tenantId as any)
  if (!provider || !provider.isConfigured()) {
    return res.status(503).json({
      message: "AI isn't switched on yet (missing text engine key).",
    })
  }

  const evidence = {
    orders_analyzed: orders.length,
    top_countries: topCountries,
    products_in_catalog: products.length,
    product_sample: productSample,
    price_range_usd: priceBand,
    stated_budget_usd: budgetUsd,
    prior_answers: answers,
    merchant_notes: notes,
  }

  const prompt = [
    "You are a senior paid-media strategist for a Direct-to-Consumer e-commerce brand.",
    "Design ONE ad campaign for Meta (Facebook/Instagram) using ONLY the real store evidence below.",
    "Reason like an expert: infer the target market from where orders actually ship; infer audience",
    "from the catalog and price band; pick an objective from the store's stage (no sales/no pixel →",
    "traffic or awareness with a low starting budget; proven sales → a sales objective scaled to the",
    "price band). NEVER invent facts. If a decision truly needs the merchant (e.g. no orders yet so no",
    "market signal, or budget unknown, or two strong markets), put it in `questions` and still give",
    "your best provisional recommendation.",
    "",
    "STORE EVIDENCE (JSON):",
    JSON.stringify(evidence),
    "",
    "Reply with STRICT JSON only, this exact shape:",
    "{",
    '  "recommendation": {',
    '    "goal": "sales" | "traffic" | "awareness",',
    '    "daily_budget_usd": number,',
    '    "countries": ["ISO-2", ...],',
    '    "genders": "all" | "male" | "female",',
    '    "age_min": number, "age_max": number,',
    '    "creative_angle": "one concrete angle referencing a real product/category"',
    "  },",
    '  "why": { "goal": "...", "budget": "...", "countries": "...", "audience": "...", "creative": "..." },',
    '  "questions": [ { "field": "budget|countries|...", "ask": "a short plain question" } ],',
    '  "confidence": "low" | "medium" | "high"',
    "}",
    "Keep every `why` to one evidence-based sentence. Only include `questions` that genuinely change the plan.",
  ].join("\n")

  let ai: Record<string, any>
  let raw = ""
  try {
    raw = String(
      (await provider.generate(prompt, {
        maxTokens: 1600,
        temperature: 0.4,
        json: true,
        feature: "ad_strategist",
      } as any)) ?? ""
    )
    ai = parseJson(raw)
  } catch (e: any) {
    return res.status(502).json({
      message: e?.message ?? "The strategist couldn't produce a plan — try again.",
      raw: raw.slice(0, 1600),
    })
  }

  const rec = (ai.recommendation ?? {}) as Record<string, any>
  // Normalize to the wizard's field names + sane guards.
  const recommendation = {
    goal: ["sales", "traffic", "awareness"].includes(rec.goal) ? rec.goal : "traffic",
    daily_budget: Math.max(1, Math.round(toNum(rec.daily_budget_usd) ?? (budgetUsd ? budgetUsd / 30 : 8))),
    countries: Array.isArray(rec.countries) && rec.countries.length
      ? rec.countries.map((c: any) => String(c).toUpperCase().slice(0, 2))
      : hasMarket
        ? [topCountries[0].code]
        : [],
    genders: ["all", "male", "female"].includes(rec.genders) ? rec.genders : "all",
    age_min: Math.min(65, Math.max(13, toNum(rec.age_min) ?? 18)),
    age_max: Math.min(65, Math.max(13, toNum(rec.age_max) ?? 55)),
    creative_angle: String(rec.creative_angle ?? "").trim(),
  }

  return res.status(200).json({
    recommendation,
    why: ai.why ?? {},
    questions: Array.isArray(ai.questions) ? ai.questions.slice(0, 4) : [],
    confidence: ai.confidence ?? (hasSales ? "medium" : "low"),
    evidence: {
      orders_analyzed: orders.length,
      top_countries: topCountries,
      products_in_catalog: products.length,
      price_range_usd: priceBand,
      has_sales: hasSales,
    },
  })
}
