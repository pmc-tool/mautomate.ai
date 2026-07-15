import crypto from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { requireWriteTenant } from "../../../modules/cms/tenant-scope"
import { validateBlockData } from "../../../modules/cms/registry"
import { PLATFORM_MODULE } from "../../../modules/platform"
import { getLedger } from "../../../modules/platform/credits/metering"
import { creditsFor } from "../../../modules/platform/pricing/price-book"

/**
 * POST /cms/ai-edit — AI page editor gateway (TWO-STAGE, token-lean).
 *
 * COST IS THE CONSTRAINT. Sending the whole page + full catalog on every message
 * costs ~5-6k input tokens per edit and grows with page length — economically
 * broken at 10k merchants. So we split the work:
 *
 *   STAGE 1 (ROUTE, ~300 tok): the model sees only a tiny OUTLINE
 *     [{i, type, hint}] + the request, and answers WHICH blocks to touch and
 *     what kind of change (edit / insert / remove / move). Cheap model.
 *   STAGE 2 (EDIT, ~500-900 tok): only for blocks being edited/inserted — the
 *     model sees ONLY those blocks' data and ONLY those blocks' schemas, and
 *     returns their patches. Structural ops (remove/move) skip stage 2 entirely
 *     and cost NOTHING extra.
 *
 * A one-word change to one section costs ~1k tokens total instead of ~6k, and
 * the cost stays flat as pages grow (the outline barely changes).
 *
 * Every patch is still simulated + validated against the block registry before
 * it is returned; the editor applies them through its own undo pipeline, so an
 * AI edit is as reversible as a manual one and never touches the live site.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest()
  const hb = crypto.createHash("sha256").update(b, "utf8").digest()
  return crypto.timingSafeEqual(Uint8Array.from(ha), Uint8Array.from(hb))
}

const NOVITA_URL = "https://api.novita.ai/v3/openai/chat/completions"
const EDIT_MODEL = () => process.env.NOVITA_MODEL || "moonshotai/kimi-k2.7-code"
/** Stage 1 only picks indices — a small model is plenty and ~10x cheaper. */
const ROUTE_MODEL = () => process.env.NOVITA_ROUTE_MODEL || EDIT_MODEL()

/** Hard ceiling per request (both stages). Refuse rather than surprise-bill. */
const TOKEN_BUDGET = Number(process.env.AI_EDIT_TOKEN_BUDGET || 12000)

const ROUTE_SYSTEM = `You plan edits to an e-commerce page. You see an OUTLINE of the page (blocks as {i, type, text}) and TYPES (each allowed block type with the fields it supports). Decide the MINIMUM set of operations that satisfies the request.
Reply ONLY: {"edit":[i,...],"insert":[{"at":N,"block_type":"<type>","why":"<short>"}],"remove":[i,...],"move":[{"from":N,"to":N}],"note":"<one short sentence>","cannot":"<empty string, or an explanation>"}
Use [] for anything not needed.
ACT — do not interrogate. If the request is actionable, perform it. Resolve vague words ("here", "there", "this section") from the conversation and the outline. Only ask a question when you truly cannot tell WHICH section is meant and the conversation gives no clue.
ADD, DON'T DESTROY: "remove" is ONLY for an explicit remove/delete/get-rid-of request. If the user asks to ADD something (e.g. "make an image gallery there", "add a gallery in X"), INSERT the new block at that section's index + 1 and leave the existing section intact. Never replace a block unless the user says "replace".
Match the user's words to a block by its TEXT (e.g. a request about "our promise" refers to the block whose text contains "Our promise").
The earlier messages in this conversation are CONTEXT — carry them forward. If the user names a section in one message and says what to do in the next (or vice-versa), COMBINE them and act. Never ask again for something already said. Only ask a question if the request is genuinely ambiguous after considering the whole conversation, and then put the question in "cannot".
CRITICAL — BE HONEST. If the request needs a field or capability that the block types do NOT have (check the fields in TYPES), or you cannot find the section they mean, then return empty operations and set "cannot" to a short, plain explanation of exactly what is not possible and what the user COULD do instead. Never pretend nothing was needed. Only leave "cannot" empty when you are genuinely performing the operations you listed.`

const EDIT_SYSTEM = `You edit e-commerce page blocks. You are given only the blocks you must change and their schemas.
Reply ONLY: {"patches":[...]} where each patch is:
- {"op":"replace_props","index":N,"props":{...}} — N is the block's ORIGINAL index; include ONLY the prop keys you changed; never include block_type; preserve everything you are not changing.
- {"op":"insert_section","at":N,"block_type":"<type>","props":{...}}
Rules: use only prop names from the given schemas; write full final values (never "..." or truncations); keep copy concise, natural and on-brand; never invent product ids or prices.
IMAGES — CRITICAL: NEVER invent, guess, or use an external image URL (no unsplash/stock/CDN/example URLs). Keep existing image values exactly as they are unless the user explicitly gives a new URL. For a NEW block that needs images, set every image field to the empty string "" and mention in your copy that the merchant should pick the images — the editor shows an image picker for empty fields. An invented URL is a broken image on a real store.`

type Json = Record<string, any>

async function call(
  model: string,
  messages: any[],
  maxTokens: number
): Promise<{ content: string; tokens: number }> {
  const key = process.env.NOVITA_API_KEY
  if (!key) throw new MedusaError(MedusaError.Types.INVALID_DATA, "AI is not configured.")
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 90000)
  try {
    const r = await fetch(NOVITA_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages,
      }),
    })
    const body: any = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(body?.error?.message || body?.message || `provider ${r.status}`)
    return {
      content: body?.choices?.[0]?.message?.content ?? "",
      tokens: body?.usage?.total_tokens ?? 0,
    }
  } finally {
    clearTimeout(t)
  }
}

const parse = (s: string): Json | null => {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

/** The block's visible TEXT (several snippets) so the router can match the
 *  user's words ("our promise") to the right block. Cheap: capped at 120 chars. */
function hintOf(b: Json): string {
  const found: string[] = []
  const walk = (o: any, depth = 0) => {
    if (o == null || depth > 3 || found.length >= 4) return
    if (typeof o === "string") {
      const t = o.trim()
      // Skip urls/paths/ids — they are noise for matching.
      if (t && t.length > 2 && !/^[/#]|^https?:|\.(png|jpe?g|webp|svg)$/i.test(t)) {
        found.push(t.slice(0, 40))
      }
      return
    }
    if (Array.isArray(o)) {
      o.slice(0, 3).forEach((x) => walk(x, depth + 1))
      return
    }
    if (typeof o === "object") {
      // Prefer the human-facing keys first.
      for (const k of ["title", "heading", "eyebrow", "kicker", "label", "body", "text", "name", "subtitle"]) {
        if (typeof o[k] === "string") walk(o[k], depth + 1)
      }
      for (const [k, v] of Object.entries(o)) {
        if (["style", "advanced", "elementStyles", "image", "href", "image_side"].includes(k)) continue
        if (typeof v !== "string") walk(v, depth + 1)
      }
    }
  }
  const { block_type, style, advanced, ...rest } = b as any
  walk(rest)
  return found.join(" | ").slice(0, 120)
}

/** Drop editor noise + truncate long strings — used only for blocks we edit. */
function shrink(v: any, depth = 0): any {
  if (v == null) return v
  if (typeof v === "string") return v.length > 400 ? v.slice(0, 400) : v
  if (typeof v === "number" || typeof v === "boolean") return v
  if (Array.isArray(v)) return v.slice(0, 10).map((x) => shrink(x, depth + 1))
  if (typeof v === "object") {
    if (depth > 4) return undefined
    const out: Json = {}
    for (const [k, val] of Object.entries(v)) {
      if (k === "style" || k === "advanced" || k === "elementStyles") continue
      const sv = shrink(val, depth + 1)
      if (sv !== undefined) out[k] = sv
    }
    return out
  }
  return undefined
}

/** Reject image values that were invented (external/stock URLs). We only ever
 *  allow images that already exist on this store (relative paths / our own
 *  media host) — anything else becomes "" so the merchant picks a real image.
 *  A hallucinated stock URL is a broken image on a live storefront. */
function scrubImages(v: any, key?: string): any {
  if (typeof v === "string") {
    const looksExternal = /^https?:\/\//i.test(v)
    const imageKey = !!key && /(^|_)image(s)?$|photo|thumbnail|logo|avatar|picture/i.test(key)
    if (imageKey && looksExternal) return ""
    return v
  }
  if (Array.isArray(v)) return v.map((x) => scrubImages(x, key))
  if (v && typeof v === "object") {
    const out: Record<string, any> = {}
    for (const [k, val] of Object.entries(v)) out[k] = scrubImages(val, k)
    return out
  }
  return v
}

/** Validate patches by simulating them against the real page + registry. */
function checkPatches(patches: any, blocks: any[]): string[] {
  const errs: string[] = []
  if (!Array.isArray(patches)) return ["patches must be an array"]
  if (patches.length > 20) return ["too many patches"]
  const sim = [...blocks]
  patches.forEach((p: Json, i: number) => {
    if (!p || typeof p !== "object") return errs.push(`patch ${i}: not an object`)
    if (p.op === "replace_props") {
      if (typeof p.index !== "number" || !sim[p.index]) return errs.push(`patch ${i}: bad index`)
      if (!p.props || typeof p.props !== "object") return errs.push(`patch ${i}: props required`)
      if ("block_type" in p.props) return errs.push(`patch ${i}: must not change block_type`)
      const { block_type, ...data } = { ...sim[p.index], ...p.props }
      const v = validateBlockData(block_type, data)
      if (!v.valid) return errs.push(`patch ${i}: ${v.errors.join("; ")}`)
      sim[p.index] = { block_type, ...data }
    } else if (p.op === "insert_section") {
      if (typeof p.at !== "number" || typeof p.block_type !== "string")
        return errs.push(`patch ${i}: at + block_type required`)
      const v = validateBlockData(p.block_type, p.props ?? {})
      if (!v.valid) return errs.push(`patch ${i}: ${v.errors.join("; ")}`)
      sim.splice(Math.max(0, Math.min(p.at, sim.length)), 0, {
        block_type: p.block_type,
        ...(p.props ?? {}),
      })
    } else if (p.op === "remove_section") {
      if (typeof p.index !== "number" || !sim[p.index]) return errs.push(`patch ${i}: bad index`)
      sim.splice(p.index, 1)
    } else if (p.op === "move_section") {
      if (typeof p.from !== "number" || typeof p.to !== "number" || !sim[p.from])
        return errs.push(`patch ${i}: bad from/to`)
      const [m] = sim.splice(p.from, 1)
      sim.splice(Math.max(0, Math.min(p.to, sim.length)), 0, m)
    } else {
      errs.push(`patch ${i}: unknown op "${p.op}"`)
    }
  })
  return errs
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const provided = req.headers["x-cms-secret"]
  const expected = process.env.CMS_REVALIDATE_SECRET
  if (!expected || typeof provided !== "string" || !safeEqual(provided, expected)) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Invalid secret.")
  }
  if (process.env.AI_EDITOR_ENABLED === "0") {
    return res.status(503).json({ error: "AI editor is disabled." })
  }
  const tenantId = await requireWriteTenant(req)

  // An AI page edit runs a two-stage LLM call — it was free until now.
  const ledger = getLedger(req.scope)
  const editRid = `cres_edit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const editReserve = await ledger.reserve(tenantId, "ai_page_edit", 1, {
    reservationId: editRid,
  })
  if (!editReserve.ok) {
    return res.status(402).json({
      error: `You're out of AI credits (this needs ${creditsFor("ai_page_edit")}). Top up in Billing.`,
    })
  }
  const releaseEdit = () => ledger.release(editRid).catch(() => {})
  const commitEdit = () => ledger.commit(editRid).catch(() => {})

  const b = (req.body ?? {}) as Json
  const instruction = typeof b.instruction === "string" ? b.instruction.slice(0, 1000) : ""
  const blocks: Json[] = Array.isArray(b.blocks) ? b.blocks : []
  const catalog: Json[] = Array.isArray(b.catalog) ? b.catalog : []
  const brand = typeof b.brand === "string" ? b.brand.slice(0, 80) : "the store"
  // Conversation memory: the last few turns, so follow-ups like "in our promise
  // section" then "make a gallery" resolve against what was already said.
  const history: Json[] = (Array.isArray(b.history) ? b.history : [])
    .filter((h: any) => h && (h.role === "user" || h.role === "ai") && typeof h.text === "string")
    .slice(-6)
    .map((h: any) => ({
      role: h.role === "ai" ? "assistant" : "user",
      content: String(h.text).slice(0, 500),
    }))
  if (!instruction.trim()) return res.status(400).json({ error: "instruction required" })
  if (blocks.length > 60) return res.status(400).json({ error: "page has too many sections for one AI edit" })

  const schemaOf = (t: string) => catalog.find((c) => c?.type === t)
  let tokens = 0

  try {
    /* ---------------- STAGE 1 — ROUTE (tiny) ---------------- */
    const outline = blocks.map((blk, i) => ({ i, type: blk.block_type, text: hintOf(blk) }))
    // Give the router each type WITH its field names, so it can tell whether a
    // request is even possible (e.g. "collage" needs a multi-image field).
    const types = catalog.map((c: any) => ({
      type: c?.type,
      fields: (c?.fields ?? [])
        .map((f: any) => (f?.fields ? `${f.name}[${f.fields.map((s: any) => s.name).join(",")}]` : f?.name))
        .filter(Boolean),
    }))
    const r1 = await call(
      ROUTE_MODEL(),
      [
        { role: "system", content: ROUTE_SYSTEM },
        ...history,
        {
          role: "user",
          content: `STORE: ${brand}\nTYPES: ${JSON.stringify(types)}\nOUTLINE: ${JSON.stringify(outline)}\nREQUEST: ${instruction}`,
        },
      ],
      600
    )
    tokens += r1.tokens
    const plan = parse(r1.content) ?? {}
    if (process.env.AI_EDIT_DEBUG === "1") {
      console.log("[ai-edit] route plan:", r1.content.slice(0, 500))
    }
    const editIdx: number[] = (Array.isArray(plan.edit) ? plan.edit : [])
      .filter((n: any) => Number.isInteger(n) && blocks[n])
      .slice(0, 6)
    const inserts: Json[] = (Array.isArray(plan.insert) ? plan.insert : []).slice(0, 3)
    const removes: number[] = (Array.isArray(plan.remove) ? plan.remove : []).filter(
      (n: any) => Number.isInteger(n) && blocks[n]
    )
    const moves: Json[] = (Array.isArray(plan.move) ? plan.move : []).filter(
      (m: any) => Number.isInteger(m?.from) && Number.isInteger(m?.to) && blocks[m.from]
    )

    // The model said the request is not possible / not found: tell the user the
    // truth instead of inventing a silent no-op.
    const cannot = typeof plan.cannot === "string" ? plan.cannot.trim() : ""
    const nothingPlanned =
      !editIdx.length && !inserts.length && !removes.length && !moves.length
    if (cannot && nothingPlanned) {
      return res.json({ summary: cannot, patches: [], tokens, cannot: true })
    }

    const patches: Json[] = []
    // Structural ops need NO second model call — they are free.
    for (const m of moves) patches.push({ op: "move_section", from: m.from, to: m.to })
    for (const i of [...removes].sort((a, b) => b - a)) patches.push({ op: "remove_section", index: i })

    /* ---------------- STAGE 2 — EDIT (only what changes) ---------------- */
    if (editIdx.length || inserts.length) {
      const subject = editIdx.map((i) => ({ index: i, ...shrink(blocks[i]) }))
      const needTypes = new Set<string>([
        ...editIdx.map((i) => blocks[i].block_type),
        ...inserts.map((x) => x.block_type).filter(Boolean),
      ])
      const schemas = [...needTypes].map((t) => schemaOf(t)).filter(Boolean)

      const parts: string[] = [`STORE: ${brand}`, `SCHEMAS: ${JSON.stringify(schemas)}`]
      if (subject.length) parts.push(`BLOCKS TO EDIT: ${JSON.stringify(subject)}`)
      if (inserts.length) parts.push(`SECTIONS TO INSERT: ${JSON.stringify(inserts)}`)
      parts.push(`REQUEST: ${instruction}`)

      const msgs: any[] = [
        { role: "system", content: EDIT_SYSTEM },
        ...history,
        { role: "user", content: parts.join("\n") },
      ]
      let r2 = await call(EDIT_MODEL(), msgs, 2000)
      tokens += r2.tokens
      let out = parse(r2.content)
      let errs = checkPatches(out?.patches, blocks)

      if (errs.length && tokens < TOKEN_BUDGET) {
        msgs.push({ role: "assistant", content: r2.content })
        msgs.push({
          role: "user",
          content: `Rejected: ${errs.join(" | ")}. Reply again with corrected JSON only.`,
        })
        r2 = await call(EDIT_MODEL(), msgs, 2000)
        tokens += r2.tokens
        out = parse(r2.content)
        errs = checkPatches(out?.patches, blocks)
      }
      if (errs.length) {
        return res.status(422).json({
          error: "The AI could not produce a valid edit. Nothing was changed.",
          detail: errs.slice(0, 3),
          tokens,
        })
      }
      // Strip invented external image URLs before anything is applied.
      patches.push(...((out?.patches ?? []) as Json[]).map((p) => scrubImages(p)))
    }

    // Final safety: validate the COMBINED patch list against the real page.
    const finalErrs = checkPatches(patches, blocks)
    if (finalErrs.length) {
      return res.status(422).json({
        error: "The AI could not produce a valid edit. Nothing was changed.",
        detail: finalErrs.slice(0, 3),
        tokens,
      })
    }

    // Nothing was delivered, so nothing is charged.
    if (!patches.length) {
      await releaseEdit()
      return res.json({
        summary:
          cannot ||
          "I couldn't work out which section to change. Try naming it — for example: \"in the Our Promise section, ...\".",
        patches: [],
        tokens,
        cannot: true,
      })
    }
    await commitEdit()
    res.json({
      summary: (typeof plan.note === "string" && plan.note) || "Updated the page.",
      patches,
      tokens,
    })
  } catch (e: any) {
    const msg =
      e?.name === "AbortError" || /abort/i.test(String(e?.message))
        ? "The AI took too long. Try a more specific request (e.g. name the section to change)."
        : e?.message || "AI request failed"
    console.error("[ai-edit] failed:", String(e?.message || e).slice(0, 300), "tokens:", tokens)
    res.status(502).json({ error: String(msg).slice(0, 200), tokens })
  }
}
