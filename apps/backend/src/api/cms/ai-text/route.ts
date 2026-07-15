import crypto from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { requireWriteTenant } from "../../../modules/cms/tenant-scope"
import { PLATFORM_MODULE } from "../../../modules/platform"
import { getLedger } from "../../../modules/platform/credits/metering"
import { creditsFor } from "../../../modules/platform/pricing/price-book"

/**
 * POST /cms/ai-text — single-field copy actions (the ✨ on every text control).
 *
 * DELIBERATELY TINY: one field's text in, one field's text out. No page, no
 * schema catalog, no block context — so a rewrite costs ~100-200 tokens instead
 * of thousands. This is the cheap, high-frequency sibling of /cms/ai-edit.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest()
  const hb = crypto.createHash("sha256").update(b, "utf8").digest()
  return crypto.timingSafeEqual(Uint8Array.from(ha), Uint8Array.from(hb))
}

const MODEL = () => process.env.NOVITA_TEXT_MODEL || process.env.NOVITA_MODEL || "moonshotai/kimi-k2.7-code"

const ACTIONS: Record<string, string> = {
  rewrite: "Rewrite it: same meaning, fresher and more compelling wording.",
  shorten: "Make it shorter and punchier. Keep the meaning.",
  lengthen: "Expand it slightly with useful, concrete detail. Do not pad with fluff.",
  premium: "Rewrite it to sound more premium and refined, without exaggeration.",
  friendly: "Rewrite it to sound warmer and more friendly, like a real person.",
  urgent: "Rewrite it to create honest urgency (do not invent discounts or deadlines).",
  grammar: "Fix spelling, grammar and punctuation only. Do not change the wording or tone otherwise.",
  bangla: "Translate it into natural, everyday spoken Bangla.",
  english: "Translate it into natural, everyday English.",
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const provided = req.headers["x-cms-secret"]
  const expected = process.env.CMS_REVALIDATE_SECRET
  if (!expected || typeof provided !== "string" || !safeEqual(provided, expected)) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Invalid secret.")
  }
  if (process.env.AI_EDITOR_ENABLED === "0") {
    return res.status(503).json({ error: "AI is disabled." })
  }
  const tenantId = await requireWriteTenant(req)
  const key = process.env.NOVITA_API_KEY
  if (!key) return res.status(503).json({ error: "AI is not configured." })

  const b = (req.body ?? {}) as Record<string, any>
  const text = typeof b.text === "string" ? b.text.slice(0, 4000) : ""
  const action = typeof b.action === "string" ? b.action : "rewrite"
  const custom = typeof b.custom === "string" ? b.custom.slice(0, 500) : ""
  const label = typeof b.label === "string" ? b.label.slice(0, 60) : "text"
  const brand = typeof b.brand === "string" ? b.brand.slice(0, 60) : "the store"
  const html = !!b.html

  const task = custom ? `Do this: ${custom}` : ACTIONS[action] || ACTIONS.rewrite
  if (!text.trim() && !custom) {
    return res.status(400).json({ error: "nothing to rewrite" })
  }

  const system =
    `You write copy for the "${brand}" online store. You are editing ONE field: "${label}".\n` +
    `${task}\n` +
    `Reply ONLY a JSON object: {"text":"<the new value>"}.\n` +
    (html
      ? `The value is HTML — keep it valid HTML, keep the existing tag structure, change only the wording.\n`
      : `The value is plain text — no markdown, no quotes around it, no HTML.\n`) +
    `Keep roughly the same length unless asked otherwise. Never invent prices, discounts, dates or product claims. Match the existing tone unless asked to change it.`

  const ledger = getLedger(req.scope)
  const rid = `cres_txt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const reserved = await ledger.reserve(tenantId, "ai_text", 1, { reservationId: rid })
  if (!reserved.ok) {
    return res.status(402).json({
      error: `You're out of AI credits (this needs ${creditsFor("ai_text")}). Top up in Billing.`,
    })
  }

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 45000)
  try {
    const r = await fetch("https://api.novita.ai/v3/openai/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL(),
        max_tokens: 700,
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: text || "(empty — write it from scratch)" },
        ],
      }),
    })
    const body: any = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(body?.error?.message || `provider ${r.status}`)
    const raw = body?.choices?.[0]?.message?.content ?? ""
    const tokens = body?.usage?.total_tokens ?? 0
    let out = ""
    try {
      out = String(JSON.parse(raw)?.text ?? "")
    } catch {
      out = ""
    }
    if (!out.trim()) return res.status(422).json({ error: "The AI returned nothing usable." })

    ledger.commit(rid).catch(() => {})
    res.json({ text: out, tokens })
  } catch (e: any) {
    await ledger.release(rid).catch(() => {})
    const msg = /abort/i.test(String(e?.message)) ? "The AI took too long." : e?.message || "AI request failed"
    res.status(502).json({ error: String(msg).slice(0, 160) })
  } finally {
    clearTimeout(t)
  }
}
