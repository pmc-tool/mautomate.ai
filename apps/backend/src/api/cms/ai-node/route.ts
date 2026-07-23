import crypto from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { requireWriteTenant } from "../../../modules/cms/tenant-scope"
import { validateBlockData } from "../../../modules/cms/registry"
import { getLedger } from "../../../modules/platform/credits/metering"
import { creditsFor } from "../../../modules/platform/pricing/price-book"
import {
  contractFieldKindAt,
  digestFor,
  digestVersion,
  knownItemKeys,
  knownRootKeys,
  styleWhitelistErrors,
  STYLE_DIGEST,
} from "../../../modules/cms/ai/digests"
import {
  INJECTION_PREAMBLE,
  approxTokens,
  cacheGet,
  cacheKey,
  cacheSet,
  cmsLlm,
  cmsLlmStream,
  fence,
  hashOf,
  makeNonce,
} from "../../../modules/cms/ai/llm"
import {
  applySetMap,
  getPath,
  sanitizeSetMapText,
  scrubImages,
  stripHtmlToText,
} from "../../../modules/cms/ai/patch"

/**
 * /cms/ai-node — the selection-scoped AI tiers (ARCH-AI §3.2-§3.6).
 *
 *   Tier 1 "micro" (2 cr, ai_text): one chip on ONE field (plain text in/out,
 *     streamed when `stream: true`) or one repeater item ({"set"} paths under
 *     the item). SMALL model. Budget <= 400 prompt tokens typical, 700 hard.
 *
 *   Tier 2 "node" (3 cr, ai_node_edit): free prompt / section chip on ONE
 *     node. Digest + minified node + block-type-only page outline. Output is a
 *     changed-keys path map, merged + scrubbed + registry-validated (Restyle
 *     additionally against the style whitelist) BEFORE returning. SMALL for
 *     copy, EDIT for restyle; SMALL escalates to EDIT after two validation
 *     failures. Budget <= 900 prompt tokens typical, 1500 hard.
 *
 * METERING ORDER (the no-bill-on-failure proof): budget check happens BEFORE
 * reserve; commit happens ONLY after final validation, immediately before the
 * success response; every other exit releases the reservation. A failed or
 * refused request is never billed; a delivered one always is. Identical
 * repeats within 10 min return the LRU-cached result un-billed; Regenerate
 * sends a fresh variant_nonce (deliberate cache miss, billed).
 *
 * GET returns { digestVersion, prices } — the shell's pre-flight price map.
 */

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest()
  const hb = crypto.createHash("sha256").update(b, "utf8").digest()
  return crypto.timingSafeEqual(Uint8Array.from(ha), Uint8Array.from(hb))
}

const requireSecret = (req: MedusaRequest): void => {
  const provided = req.headers["x-cms-secret"]
  const expected = process.env.CMS_REVALIDATE_SECRET
  if (!expected || typeof provided !== "string" || !safeEqual(provided, expected)) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Invalid secret.")
  }
}

type Json = Record<string, any>

/* Chip instructions — Tier 1 field actions (superset of /cms/ai-text). */
const ACTIONS: Record<string, string> = {
  rewrite: "Rewrite it: same meaning, fresher and more compelling wording.",
  shorten: "Make it shorter and punchier. Keep the meaning.",
  lengthen: "Expand it slightly with useful, concrete detail. Do not pad with fluff.",
  premium: "Rewrite it to sound more premium and refined, without exaggeration.",
  friendly: "Rewrite it to sound warmer and more friendly, like a real person.",
  urgent: "Rewrite it to create honest urgency (do not invent discounts or deadlines).",
  grammar: "Fix spelling, grammar and punctuation only. Do not change the wording or tone otherwise.",
  punchier: "Rewrite it as a short, punchy call-to-action label.",
  bangla: "Translate it into natural, everyday spoken Bangla.",
  english: "Translate it into natural, everyday English.",
}

/* Tier 2 chip instructions (free prompt uses `custom`). */
const NODE_ACTIONS: Record<string, string> = {
  rewrite: "Rewrite this section's copy: same structure and meaning, fresher and more compelling wording.",
  translate_bangla: "Translate every human-facing text field into natural, everyday spoken Bangla.",
  translate_english: "Translate every human-facing text field into natural, everyday English.",
  restyle: "Restyle this section per the request, writing only whitelisted style.* paths.",
  rewrite_item: "Rewrite this one item's copy: same meaning, fresher wording. Touch only this item's fields.",
  arrange:
    "Rearrange this slide's layers into a balanced, editorial composition. Change ONLY layer frame placements (see ARRANGE) — never wording, styling or layer order.",
}


/* 5C — "Arrange layers" (ARCH-AI §5.1). The action is item-scoped (the
   slide), runs the EDIT model, and its output is FRAME PATCHES ONLY:
   every set path must be `<itemPath>.layers.<j>.frame.base` (device
   overrides are unreachable by construction — tiny-screen art direction
   stays human, per ARCH-SLIDER) and every value a complete frame with a
   legal anchor, offsets in -100..100 and sizes in (0,100] or "auto".
   Numeric validation happens server-side BEFORE merge; failures feed the
   normal retry/escalation loop and are never billed. */
const ARRANGE_ANCHORS = new Set(["tl", "tc", "tr", "cl", "cc", "cr", "bl", "bc", "br"])

function arrangeErrors(set: Json, itemPath: string): string[] {
  const errs: string[] = []
  const prefix = `${itemPath}.layers.`
  for (const [path, v] of Object.entries(set)) {
    const rest = path.startsWith(prefix) ? path.slice(prefix.length) : null
    if (rest == null || !/^\d+\.frame\.base$/.test(rest)) {
      errs.push(`"${path}": arrange may only write ${itemPath}.layers.<j>.frame.base`)
      continue
    }
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      errs.push(`"${path}": frame must be an object`)
      continue
    }
    const f = v as Json
    const extra = Object.keys(f).filter((k) => !["anchor", "x", "y", "w", "h"].includes(k))
    if (extra.length) {
      errs.push(`"${path}": unknown frame key "${extra[0]}"`)
      continue
    }
    if (!ARRANGE_ANCHORS.has(f.anchor)) {
      errs.push(`"${path}": anchor must be one of tl,tc,tr,cl,cc,cr,bl,bc,br`)
      continue
    }
    for (const k of ["x", "y"]) {
      const n = f[k]
      if (typeof n !== "number" || !Number.isFinite(n) || n < -100 || n > 100) {
        errs.push(`"${path}": ${k} must be a number between -100 and 100`)
      }
    }
    for (const k of ["w", "h"]) {
      const n = f[k]
      if (!(n === "auto" || (typeof n === "number" && Number.isFinite(n) && n > 0 && n <= 100))) {
        errs.push(`"${path}": ${k} must be "auto" or a number between 0 and 100`)
      }
    }
  }
  return errs
}

/* Budgets (prompt tokens, chars/4): [typical, hard cap] per ARCH-AI. */
const MICRO_CAP = 700
const NODE_CAP = 1500
const parse = (s: string): Json | null => {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

/** The Tier-1 honesty sentinel (the `cannot` channel for plain-text mode):
 *  a styling/appearance ask on a copy field is REFUSED with a pointer, never
 *  answered through the copy — and, like Tier 2's cannot, never billed. */
const STYLE_POINTER = "Use the Restyle option or the Style tab to change appearance."
const CANNOT_SENTINEL = /^\s*["'`]*\s*CANNOT\s*:\s*/i
const cannotOf = (s: string): string | null =>
  CANNOT_SENTINEL.test(s)
    ? s.replace(CANNOT_SENTINEL, "").replace(/["'`]+$/, "").trim().slice(0, 200) ||
      STYLE_POINTER
    : null

/** Defensive cleanup of a plain-value completion (fences/wrapping quotes). */
const cleanPlain = (s: string): string => {
  let out = s.trim()
  out = out.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim()
  if (out.length > 1 && out.startsWith('"') && out.endsWith('"')) {
    try {
      const j = JSON.parse(out)
      if (typeof j === "string") out = j
    } catch {
      /* keep as-is */
    }
  }
  return out
}

/** Tier-2 node minification: strings capped, arrays capped at 6 + sentinel,
 *  style stripped unless restyle, advanced/elementStyles/meta always stripped. */
function shrinkNode(v: any, keepStyle: boolean, depth = 0): any {
  if (v == null) return v
  if (typeof v === "string") return v.length > 400 ? v.slice(0, 400) : v
  if (typeof v === "number" || typeof v === "boolean") return v
  if (Array.isArray(v)) {
    const out = v.slice(0, 6).map((x) => shrinkNode(x, keepStyle, depth + 1))
    if (v.length > 6) out.push(`(+${v.length - 6} more items not shown — patch only what you see)`)
    return out
  }
  if (typeof v === "object") {
    if (depth > 4) return undefined
    const out: Json = {}
    for (const [k, val] of Object.entries(v)) {
      if (k === "advanced" || k === "elementStyles" || k === "block_type" || k === "schema_version" || k === "id") continue
      if (k === "style" && !keepStyle) continue
      const sv = shrinkNode(val, keepStyle, depth + 1)
      if (sv !== undefined) out[k] = sv
    }
    return out
  }
  return undefined
}

/* ------------------------------------------------------------------ */
/* GET — price map + digest version (shell pre-flight, §3.8)           */
/* ------------------------------------------------------------------ */

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  requireSecret(req)
  res.json({
    digestVersion: digestVersion(),
    prices: {
      ai_text: creditsFor("ai_text"),
      ai_node_edit: creditsFor("ai_node_edit"),
      ai_page_edit: creditsFor("ai_page_edit"),
      ai_image: creditsFor("ai_image"),
    },
  })
}

/* ------------------------------------------------------------------ */
/* POST — Tier 1 (micro) and Tier 2 (node)                             */
/* ------------------------------------------------------------------ */

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  requireSecret(req)
  if (process.env.AI_EDITOR_ENABLED === "0") {
    return res.status(503).json({ error: "AI is disabled." })
  }
  const tenantId = await requireWriteTenant(req)
  const ledger = getLedger(req.scope)

  const b = (req.body ?? {}) as Json
  const tier = b.tier === "node" ? "node" : "micro"
  const action = typeof b.action === "string" ? b.action : "rewrite"
  const custom = typeof b.custom === "string" ? b.custom.slice(0, 500) : ""

  // Deterministic style-intent refusal (owner bug follow-up): asking a COPY
  // surface to change appearance must never reach the model — the sentinel
  // instruction is model-dependent (the small model demonstrably ignores it
  // and bills for garbage like "#red"). Narrow on explicit appearance nouns
  // so copy like "make it say RED SALE" still rewrites. Restyle-action
  // requests never pass through here (they route to the style whitelist).
  const STYLE_INTENT_RE =
    /\b(colou?r|background|font(?:\s|-)?(?:size|family|weight)?|underline|italic|bold(?:er)?|bigger|smaller|larger|spacing|padding|margin|opacity|shadow)\b/i
  if (b.action !== "restyle" && custom && STYLE_INTENT_RE.test(custom)) {
    return res.json({
      cannot: "Use the Restyle option or the Style tab to change appearance.",
      text: null,
      set: null,
      tokens: 0,
      credits: 0,
    })
  }
  const brand = typeof b.brand === "string" ? b.brand.slice(0, 60) : "the store"
  const variantNonce = Number.isInteger(b.variant_nonce) ? (b.variant_nonce as number) : 0
  const nonce = makeNonce()

  const itemPath = typeof b.item_path === "string" ? b.item_path.slice(0, 100) : ""
  const isItemMicro = tier === "micro" && !!itemPath
  const isNodeTier = tier === "node" || isItemMicro
  const isRestyle = tier === "node" && action === "restyle"
  const isArrange = isItemMicro && action === "arrange" && !custom

  /* ---------------- build the prompt (NOTHING billed yet) ---------------- */

  let system = ""
  let user = ""
  let node: Json | null = null
  let blockType = ""
  let knownKeys: Set<string> | null = null
  let startModel: "small" | "edit" = "small"
  let maxTokens = 700
  let temperature = 0.6
  let plainText = false // Tier 1 field mode: raw text out (streamable)
  let microHtml = false // Tier 1 field mode: the field's declared kind is html

  if (isNodeTier) {
    node = b.node && typeof b.node === "object" && !Array.isArray(b.node) ? (b.node as Json) : null
    blockType = typeof b.block_type === "string" ? b.block_type : ""
    if (!node || !blockType) {
      return res.status(400).json({ error: "block_type and node are required for this tier" })
    }
    const digest = digestFor(blockType)
    if (!digest) {
      return res.status(400).json({ error: `Unknown section type "${blockType}".` })
    }
    const task = custom
      ? `Do this: ${custom}`
      : NODE_ACTIONS[isItemMicro ? (isArrange ? "arrange" : "rewrite_item") : action] ||
        NODE_ACTIONS.rewrite

    system =
      `You edit ONE section of the "${brand}" e-commerce page. Reply ONLY JSON: {"set":{"<fieldPath>":<value>,...},"note":"<one short line>"} — CHANGED field paths only (dot paths like "title" or "items.2.quote"). Write full final values, never truncations.\n` +
      `Never: change block_type, invent product ids/prices/dates, add external links, set any image field (keep it or use ""), touch fields you were not asked about.` +
      (isRestyle
        ? `\nThis is a STYLING request: you may ONLY write style.* paths listed in STYLE.`
        : `\nNever write style.* paths — copy only. Field values must be plain text — never HTML or markdown — unless the SCHEMA marks that field html.` +
          `\nIf the request is about styling, color, size or appearance rather than wording, reply {"set":{},"note":"${STYLE_POINTER}"}.`) +
      `\nIf the request is impossible for this section's fields, reply {"set":{},"note":"<why, one plain line>"}.\n` +
      INJECTION_PREAMBLE

    const pageTypes: string[] = Array.isArray(b.page_types)
      ? (b.page_types as any[]).filter((t) => typeof t === "string").slice(0, 40)
      : []
    const selIdx = Number.isInteger(b.selected_index) ? (b.selected_index as number) : -1
    const outlineLine = pageTypes.length
      ? `PAGE: ${pageTypes.map((t, i) => (i === selIdx ? `[${t}]` : t)).join(", ")}\n`
      : ""

    // Item-scope micro sends ONLY the item's fields (§3.2) — the full node
    // stays server-side for validation; the prompt carries just the subtree.
    const itemSegs = itemPath ? itemPath.split(".") : null
    const itemData = itemSegs ? getPath(node, itemSegs) : undefined
    if (isItemMicro && (itemData == null || typeof itemData !== "object")) {
      return res.status(400).json({ error: "item_path does not resolve on this section" })
    }
    // P2V F1: the legal field set for this edit's scope — registry defaults
    // (the same source the digest shows the model) unioned with the node's
    // ACTUAL keys so legacy/optional fields already on the node stay editable.
    // Null (unregistered type / unknowable item shape) keeps the previous
    // permissive behavior.
    if (isItemMicro) {
      const itemKeys = knownItemKeys(blockType, itemPath)
      if (itemKeys) {
        knownKeys = itemKeys
        if (itemData && typeof itemData === "object" && !Array.isArray(itemData)) {
          for (const k of Object.keys(itemData)) knownKeys.add(k)
        }
      }
    } else {
      const rootKeys = knownRootKeys(blockType)
      if (rootKeys) {
        knownKeys = rootKeys
        for (const k of Object.keys(node)) knownKeys.add(k)
      }
    }
    const shrunk = isItemMicro
      ? shrinkNode(itemData, false)
      : shrinkNode(node, isRestyle)
    user =
      outlineLine +
      `SCHEMA: ${digest}\n` +
      (isRestyle ? `${STYLE_DIGEST}\n` : "") +
      (isArrange
        ? `ARRANGE: write ONLY paths "${itemPath}.layers.<j>.frame.base" — never frame.tablet or frame.mobile. A frame is {"anchor","x","y","w","h"}: anchor is one of tl,tc,tr,cl,cc,cr,bl,bc,br (first letter = vertical row top/center/bottom, second = horizontal column left/center/right); x,y are PERCENT offsets from the anchor toward the slide interior (center axes: signed offset from the middle); w,h are percent of the slide (1-100) or "auto". Keep layers inside the slide and visually non-overlapping; array order is z-order and must not change.\n`
        : "") +
      (isItemMicro
        ? `ITEM (${itemPath} — every set path must start with "${itemPath}."): ${fence(JSON.stringify(shrunk), nonce)}\n`
        : `NODE: ${fence(JSON.stringify(shrunk), nonce)}\n`) +
      `REQUEST: ${task}`

    // Arrange is spatial reasoning — EDIT model from the start (§5.1).
    startModel = isRestyle || isArrange ? "edit" : "small"
    maxTokens = 1200
    temperature = 0.4 + Math.min(0.3, variantNonce * 0.15)
  } else {
    /* Tier 1 field mode — exactly today's ai-text shape, streamable. */
    const text = typeof b.text === "string" ? b.text.slice(0, 4000) : ""
    const label = typeof b.label === "string" ? b.label.slice(0, 60) : "text"
    const html = !!b.html
    const task = custom ? `Do this: ${custom}` : ACTIONS[action] || ACTIONS.rewrite
    if (!text.trim() && !custom) {
      return res.status(400).json({ error: "nothing to rewrite" })
    }
    plainText = true
    microHtml = html
    system =
      `You write copy for the "${brand}" online store. You are editing ONE field: "${label}".\n` +
      `${task}\n` +
      (html
        ? `The value is HTML — keep it valid HTML, keep the existing tag structure, change only the wording.\n`
        : `The value is plain text — output plain text ONLY: never HTML tags, never markdown, no quotes around it.\n`) +
      `If the request is about styling, color, size or appearance rather than the wording (e.g. "make it red"), do not rewrite the text — reply exactly: CANNOT: ${STYLE_POINTER}\n` +
      `Keep roughly the same length unless asked otherwise. Never invent prices, discounts, dates or product claims.\n` +
      `Reply with the new value ONLY — no commentary, no surrounding quotes.\n` +
      INJECTION_PREAMBLE
    user = text ? fence(text, nonce) : "(empty — write it from scratch)"
    maxTokens = 700
    temperature = 0.6 + Math.min(0.3, variantNonce * 0.15)
  }

  /* ---------------- budget gate (server-side, pre-reserve) ---------------- */

  const promptTokens = approxTokens(system + user)
  const cap = tier === "node" ? NODE_CAP : MICRO_CAP
  if (promptTokens > cap) {
    return res.status(413).json({
      code: "over_budget",
      error: "This content is too long for a quick edit — try selecting a smaller part.",
      prompt_tokens: promptTokens,
    })
  }

  /* ---------------- cache (identical repeat is never re-billed) ----------- */

  const action_ = custom ? `custom:${hashOf(custom)}` : action
  const key = cacheKey([
    tenantId,
    digestVersion(),
    tier,
    isItemMicro ? itemPath : "",
    node ? hashOf(node) : hashOf(b.text ?? ""),
    blockType,
    action_,
    variantNonce,
  ])
  const cached = cacheGet<Json>(key)
  if (cached) {
    const wallet = await ledger.balance(tenantId).catch(() => null)
    return res.json({ ...cached, credits: 0, cached: true, balance: wallet?.balance ?? null })
  }

  /* ---------------- reserve -> generate -> validate -> commit ------------- */

  const billAction = tier === "node" ? ("ai_node_edit" as const) : ("ai_text" as const)
  const rid = `cres_node_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const reserved = await ledger.reserve(tenantId, billAction, 1, { reservationId: rid })
  if (!reserved.ok) {
    return res.status(402).json({
      code: "insufficient_credits",
      error: `You're out of AI credits (this needs ${creditsFor(billAction)}). Top up in Billing.`,
    })
  }
  const release = () => ledger.release(rid).catch(() => {})

  let tokens = 0

  try {
    /* ---- Tier 1 plain text (optionally streamed) ---- */
    if (plainText) {
      if (b.stream === true) {
        res.status(200)
        res.setHeader("Content-Type", "text/event-stream")
        res.setHeader("Cache-Control", "no-cache")
        res.setHeader("Connection", "keep-alive")
        ;(res as any).flushHeaders?.()
        const send = (data: Json) => res.write(`data: ${JSON.stringify(data)}\n\n`)
        // Hold early deltas until the CANNOT sentinel is ruled out — a
        // refusal must never leak into the field as streamed copy.
        const SENT = "CANNOT:"
        let held = ""
        let flushed = false
        const forward = (delta: string) => {
          if (flushed) return void send({ delta })
          held += delta
          const probe = held.replace(/^[\s"'`]+/, "").toUpperCase()
          if (probe.startsWith(SENT)) return // refusal forming — never forward
          if (SENT.startsWith(probe)) return // still ambiguous — keep holding
          flushed = true
          send({ delta: held })
        }
        try {
          const out = await cmsLlmStream(
            { system, user, maxTokens, temperature },
            forward
          )
          const raw = cleanPlain(out.text)
          const refusal = cannotOf(raw)
          if (refusal) {
            await release() // refused = never billed (the cannot channel)
            send({ cannot: refusal, error: refusal, credits: 0 })
            return res.end()
          }
          // AI textguard: a plain-text field never receives markup — unwrap
          // tags/entities; html fields pass through (sanitized on save).
          const text = microHtml ? raw : stripHtmlToText(raw)
          if (!text) throw new Error("The AI returned nothing usable.")
          const committed = await ledger.commit(rid)
          const payload = { text, tokens: out.tokens }
          cacheSet(key, payload)
          send({ done: true, ...payload, credits: committed.committed, balance: committed.balance })
        } catch (e: any) {
          await release()
          send({ error: String(e?.message || "AI request failed").slice(0, 160) })
        }
        return res.end()
      }
      const r = await cmsLlm({
        tenantId,
        tier: "small",
        system,
        user,
        json: false,
        maxTokens,
        temperature,
        feature: "cms-node-micro",
      })
      tokens += r.tokens
      const raw = cleanPlain(r.content)
      const refusal = cannotOf(raw)
      if (refusal) {
        await release() // refused = never billed (the cannot channel)
        return res.json({ cannot: refusal, text: null, tokens, credits: 0 })
      }
      // AI textguard: a plain-text field never receives markup — unwrap
      // tags/entities; html fields pass through (sanitized on save).
      const text = microHtml ? raw : stripHtmlToText(raw)
      if (!text) {
        await release()
        return res.status(422).json({ code: "invalid_patch", error: "The AI returned nothing usable.", tokens })
      }
      const committed = await ledger.commit(rid)
      const payload = { text, tokens }
      cacheSet(key, payload)
      return res.json({ ...payload, credits: committed.committed, balance: committed.balance })
    }

    /* ---- JSON tiers: generate -> merge -> scrub -> whitelist -> registry ---- */

    const attempt = async (model: "small" | "edit", feedback?: string) => {
      const messages = feedback ? `${user}\n\nREJECTED: ${feedback}\nReply again with corrected JSON only.` : user
      const r = await cmsLlm({
        tenantId,
        tier: model,
        system,
        user: messages,
        json: true,
        maxTokens,
        temperature,
        feature: tier === "node" ? "cms-node-edit" : "cms-node-micro",
      })
      tokens += r.tokens
      const out = parse(r.content)
      const set = out?.set
      const note = typeof out?.note === "string" ? out.note.slice(0, 200) : ""
      if (!set || typeof set !== "object" || Array.isArray(set)) {
        return { errors: ['reply must be {"set":{...},"note":"..."}'], note }
      }
      if (!Object.keys(set).length) {
        // The model's honesty channel: nothing it can safely do.
        return { cannot: note || "The AI could not make this change.", errors: [] as string[] }
      }
      // AI textguard: strip markup out of every string headed for a non-html
      // field (contract kind decides; unknown = plain text) BEFORE merge so
      // validation sees exactly what the client will apply. Restyle set maps
      // are owned by the style whitelist below — untouched here.
      const guarded = isRestyle
        ? (set as Json)
        : sanitizeSetMapText(set as Json, (p) => contractFieldKindAt(blockType, p))
      if (isArrange) {
        const frameErrs = arrangeErrors(guarded, itemPath)
        if (frameErrs.length) return { errors: frameErrs.slice(0, 5), note }
      }
      const { merged, before, errors } = applySetMap(node!, guarded, {
        restyle: isRestyle,
        pathPrefix: isItemMicro ? itemPath : undefined,
        knownKeys,
      })
      if (errors.length) return { errors, note }
      if (isRestyle) {
        const styleErrs = styleWhitelistErrors(Object.keys(set))
        if (styleErrs.length) return { errors: styleErrs, note }
      }
      const scrubbed = scrubImages(merged)
      const v = validateBlockData(blockType, scrubbed)
      if (!v.valid) return { errors: v.errors.slice(0, 5), note }
      // Re-read final values from the scrubbed merge so the client applies
      // exactly what validation saw (scrub may have blanked an image).
      const finalSet: Json = {}
      for (const p of Object.keys(before)) {
        const cur = getPath(scrubbed, p.split("."))
        finalSet[p] = cur === undefined ? null : cur
      }
      return { set: finalSet, before, note, errors: [] as string[] }
    }

    let result = await attempt(startModel)
    if (!result.set && !result.cannot) {
      result = await attempt(startModel, result.errors.join(" | "))
    }
    // Escalation (§3.6): SMALL failed validation twice -> one EDIT retry,
    // same reservation, same caps.
    if (!result.set && !result.cannot && startModel === "small") {
      result = await attempt("edit", result.errors.join(" | "))
    }

    if (result.cannot) {
      await release() // refused = never billed
      return res.json({ cannot: result.cannot, set: null, tokens, credits: 0 })
    }
    if (!result.set) {
      await release() // failed = never billed
      return res.status(422).json({
        code: "invalid_patch",
        error: "The AI couldn't produce a safe change — nothing was modified.",
        detail: result.errors.slice(0, 3),
        tokens,
      })
    }

    const committed = await ledger.commit(rid)
    const payload = {
      set: result.set,
      before: result.before,
      note: result.note || "",
      tokens,
      digestVersion: digestVersion(),
    }
    cacheSet(key, payload)
    return res.json({ ...payload, credits: committed.committed, balance: committed.balance })
  } catch (e: any) {
    await release()
    const msg = /abort|timeout/i.test(String(e?.message))
      ? "The AI took too long. Try again."
      : e?.message || "AI request failed"
    return res.status(502).json({ error: String(msg).slice(0, 200), tokens })
  }
}
