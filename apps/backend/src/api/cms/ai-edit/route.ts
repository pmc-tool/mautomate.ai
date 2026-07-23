import crypto from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { requireWriteTenant } from "../../../modules/cms/tenant-scope"
import { validateBlockData } from "../../../modules/cms/registry"
import { PLATFORM_MODULE } from "../../../modules/platform"
import { getLedger } from "../../../modules/platform/credits/metering"
import { creditsFor } from "../../../modules/platform/pricing/price-book"
import {
  digestFor,
  getDigests,
  digestVersion,
  knownRootKeys,
} from "../../../modules/cms/ai/digests"
import {
  INJECTION_PREAMBLE,
  cmsLlm,
  fence,
  makeNonce,
} from "../../../modules/cms/ai/llm"

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

/** Hard ceiling per request (both stages). Refuse rather than surprise-bill. */
const TOKEN_BUDGET = Number(process.env.AI_EDIT_TOKEN_BUDGET || 12000)

/* Tier 3 (ARCH-AI §3.7): TYPES/SCHEMAS come from the server digest table (the
 * client catalog is accepted but IGNORED), history is dieted and stage-1-only,
 * stage 1 runs the SMALL model by rule, and both stages go through the
 * cms/ai/llm chokepoint (Langfuse-traced marketing/ai registry — the direct
 * Novita fetch bypass is gone). External contract unchanged:
 * { summary, patches, tokens } (+ credits/balance), same 402/422/502 shapes. */

const ROUTE_SYSTEM = `You plan edits to an e-commerce page. You see an OUTLINE (one line per block: \`i type: text\`) and TYPES (each block type with its fields). Decide the MINIMUM set of operations that satisfies the request.
Reply ONLY: {"edit":[i,...],"insert":[{"at":N,"block_type":"<type>","why":"<short>"}],"remove":[i,...],"move":[{"from":N,"to":N}],"note":"<one short sentence>","cannot":"<empty, or an explanation>"}. Use [] for anything not needed.
ACT — do not interrogate. Resolve vague words ("here", "this section") from the conversation and the outline; match the user's words to a block by its TEXT. Combine earlier messages with the current one; never re-ask something already said.
ADD, DON'T DESTROY: "remove" only on an explicit remove/delete request. A request to ADD something INSERTS a new block at that section's index + 1 and leaves the existing one intact; never replace unless the user says "replace".
BE HONEST: if the request needs a field the TYPES do not have, or you cannot tell which section is meant after considering the whole conversation, return empty operations and put a short plain explanation (or your one clarifying question) in "cannot". Never pretend a no-op succeeded; leave "cannot" empty only when you are performing the listed operations.
${INJECTION_PREAMBLE}`

const EDIT_SYSTEM = `You edit e-commerce page blocks. You are given only the blocks you must change and their schemas.
Reply ONLY: {"patches":[...]} where each patch is:
- {"op":"replace_props","index":N,"props":{...}} — N is the block's ORIGINAL index; include ONLY the prop keys you changed; never include block_type; preserve everything you are not changing.
- {"op":"insert_section","at":N,"block_type":"<type>","props":{...}}
Rules: use only prop names from the given schemas; write full final values (never "..." or truncations); keep copy concise, natural and on-brand; never invent product ids or prices.
IMAGES — CRITICAL: NEVER invent, guess, or use an external image URL (no unsplash/stock/CDN/example URLs). Keep existing image values exactly as they are unless the user explicitly gives a new URL. For a NEW block that needs images, set every image field to the empty string "" and mention in your copy that the merchant should pick the images — the editor shows an image picker for empty fields. An invented URL is a broken image on a real store.
${INJECTION_PREAMBLE}`

type Json = Record<string, any>

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
      // P2V F1: every prop must be a KNOWN field of this block type (registry
      // defaults + the block's actual keys) — validateBlockData ignores
      // unknown keys, so an invented field used to be billed and persisted.
      const known = knownRootKeys(sim[p.index].block_type)
      if (known) {
        for (const k of Object.keys(sim[p.index])) known.add(k)
        const bad = Object.keys(p.props).filter((k) => !known.has(k))
        if (bad.length)
          return errs.push(
            `patch ${i}: unknown field "${bad[0]}" for ${sim[p.index].block_type}`
          )
      }
      const { block_type, ...data } = { ...sim[p.index], ...p.props }
      const v = validateBlockData(block_type, data)
      if (!v.valid) return errs.push(`patch ${i}: ${v.errors.join("; ")}`)
      sim[p.index] = { block_type, ...data }
    } else if (p.op === "insert_section") {
      if (typeof p.at !== "number" || typeof p.block_type !== "string")
        return errs.push(`patch ${i}: at + block_type required`)
      // P2V F1: an inserted block may only carry fields its type actually has.
      const knownIns = knownRootKeys(p.block_type)
      if (knownIns) {
        const bad = Object.keys(p.props ?? {}).filter((k) => !knownIns.has(k))
        if (bad.length)
          return errs.push(`patch ${i}: unknown field "${bad[0]}" for ${p.block_type}`)
      }
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

  const b = (req.body ?? {}) as Json
  const instruction = typeof b.instruction === "string" ? b.instruction.slice(0, 1000) : ""
  const blocks: Json[] = Array.isArray(b.blocks) ? b.blocks : []
  // NOTE: b.catalog is still ACCEPTED for one release but IGNORED — the model's
  // schema view now comes only from the server-compiled digests (ARCH-AI §3.1).
  const brand = typeof b.brand === "string" ? b.brand.slice(0, 80) : "the store"
  // Conversation memory, DIETED (§3.7): user turns verbatim but capped at 300
  // chars; AI turns replaced by their one-line `note` (fallback: first 120
  // chars of the stored text). Stage 1 ONLY — stage 2 gets the resolved plan.
  const historyLines: string[] = (Array.isArray(b.history) ? b.history : [])
    .filter((h: any) => h && (h.role === "user" || h.role === "ai") && (typeof h.text === "string" || typeof h.note === "string"))
    .slice(-6)
    .map((h: any) =>
      h.role === "ai"
        ? `ai: ${String(h.note ?? h.text).slice(0, 120)}`
        : `user: ${String(h.text).slice(0, 300)}`
    )
  if (!instruction.trim()) return res.status(400).json({ error: "instruction required" })
  if (blocks.length > 60) return res.status(400).json({ error: "page has too many sections for one AI edit" })

  const nonce = makeNonce()
  let tokens = 0

  try {
    /* ---------------- STAGE 1 — ROUTE (tiny, SMALL model) ---------------- */
    // Compact line outline (`i type: text`) — ~25% fewer tokens than the old
    // JSON array for the same matching signal.
    const outline = blocks
      .map((blk, i) => `${i} ${blk.block_type}: ${hintOf(blk).slice(0, 100)}`)
      .join("\n")
    // TYPES from the server digest table (names-only, ~half the old client
    // blob) so the router can tell whether a request is even possible.
    const r1 = await cmsLlm({
      tenantId,
      tier: "small",
      system: ROUTE_SYSTEM,
      user:
        `STORE: ${brand}\nTYPES:\n${getDigests().typeTable}\n` +
        (historyLines.length ? `CONVERSATION:\n${historyLines.join("\n")}\n` : "") +
        `OUTLINE:\n${fence(outline, nonce)}\nREQUEST: ${instruction}`,
      json: true,
      maxTokens: 600,
      feature: "cms-page-route",
    })
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
      await releaseEdit() // refused = never billed (was leaked as a stuck reservation)
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
      // SCHEMAS = server-compiled digests (~40-80 tok/type vs 150-400 for the
      // old client-shipped JSON schemas) — and no longer client-authored.
      const schemas = [...needTypes].map((t) => digestFor(t)).filter(Boolean)

      const parts: string[] = [`STORE: ${brand}`, `SCHEMAS:\n${schemas.join("\n\n")}`]
      if (subject.length) parts.push(`BLOCKS TO EDIT: ${fence(JSON.stringify(subject), nonce)}`)
      if (inserts.length) parts.push(`SECTIONS TO INSERT: ${JSON.stringify(inserts)}`)
      // Stage 2 gets NO conversation history — stage 1's plan already encodes
      // the conversation's intent (its note rides along as the resolved plan).
      parts.push(`REQUEST: ${instruction}`)
      if (typeof plan.note === "string" && plan.note) parts.push(`PLAN: ${plan.note}`)

      const stage2 = (feedback?: string) =>
        cmsLlm({
          tenantId,
          tier: "edit",
          system: EDIT_SYSTEM,
          user: feedback
            ? `${parts.join("\n")}\n\nREJECTED: ${feedback}\nReply again with corrected JSON only.`
            : parts.join("\n"),
          json: true,
          maxTokens: 2000,
          feature: "cms-page-edit",
        })

      let r2 = await stage2()
      tokens += r2.tokens
      let out = parse(r2.content)
      let errs = checkPatches(out?.patches, blocks)

      if (errs.length && tokens < TOKEN_BUDGET) {
        r2 = await stage2(errs.join(" | "))
        tokens += r2.tokens
        out = parse(r2.content)
        errs = checkPatches(out?.patches, blocks)
      }
      if (errs.length) {
        await releaseEdit() // failed = never billed
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
      await releaseEdit() // failed = never billed
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
    // Commit strictly AFTER final validation — a delivered edit is always
    // billed, a failed one never is (ARCH-AI §3.5 / invariant 3).
    const committed = await ledger.commit(editRid).catch(() => null)
    res.json({
      summary: (typeof plan.note === "string" && plan.note) || "Updated the page.",
      patches,
      tokens,
      credits: committed?.committed ?? creditsFor("ai_page_edit"),
      balance: committed?.balance ?? null,
      digestVersion: digestVersion(),
    })
  } catch (e: any) {
    await releaseEdit() // provider failure = never billed
    const msg =
      e?.name === "AbortError" || /abort|timeout/i.test(String(e?.message))
        ? "The AI took too long. Try a more specific request (e.g. name the section to change)."
        : e?.message || "AI request failed"
    console.error("[ai-edit] failed:", String(e?.message || e).slice(0, 300), "tokens:", tokens)
    res.status(502).json({ error: String(msg).slice(0, 200), tokens })
  }
}
