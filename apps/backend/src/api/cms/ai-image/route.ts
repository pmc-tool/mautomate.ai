import crypto from "crypto"
import sharp from "sharp"
import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { uploadFilesWorkflow } from "@medusajs/core-flows"
import { CMS_MODULE } from "../../../modules/cms"
import { requireWriteTenant } from "../../../modules/cms/tenant-scope"
import { PLATFORM_MODULE } from "../../../modules/platform"
import { getLedger } from "../../../modules/platform/credits/metering"
import { checkImageQuota } from "../../../modules/platform/billing/plan-gate"
import { creditsFor, type BillableAction } from "../../../modules/platform/pricing/price-book"

/**
 * POST /cms/ai-image — AI image generation that produces USABLE assets.
 *
 * The whole point is that a generated image must drop into the slot it was made
 * for and look right there — not "a square that sort of matches".
 *
 *  - SIZE IS DERIVED FROM THE SLOT, not asked of the user. A hero gets a wide
 *    1344x768, a banner strip 1536x640, a gallery tile a square 1024, a portrait
 *    832x1216. These are SDXL's native-trained aspect buckets, so the model
 *    composes for the frame instead of generating a square and letting the theme
 *    crop the subject's head off.
 *  - LOGOS COME BACK AS TRANSPARENT PNG. We generate the mark on a flat white
 *    field, then run Novita's remove-background and emit PNG — so it sits on any
 *    header colour. A logo on a white box is the classic "gimmick" giveaway.
 *  - PRODUCT CUT-OUTS: `transparent: true` on any kind runs the same background
 *    removal, so a product can be composited onto a banner.
 *  - Each kind carries its own prompt scaffolding + negative prompt (the real
 *    quality lever). Merchants write "ceramic mug"; we add the studio lighting,
 *    the clean background, and the "no text, no watermark, no extra limbs".
 *
 * Two actions:
 *   generate → returns N temporary preview URLs (nothing is stored yet)
 *   save     → fetches ONE chosen image and stores it permanently in the
 *              tenant's media library (same File Module path as a manual upload)
 */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest()
  const hb = crypto.createHash("sha256").update(b, "utf8").digest()
  return crypto.timingSafeEqual(Uint8Array.from(ha), Uint8Array.from(hb))
}

const NOVITA = "https://api.novita.ai/v3"
const MODEL = () => process.env.NOVITA_IMAGE_MODEL || "sd_xl_base_1.0.safetensors"
/** Novita 403s an unknown/default UA (python-urllib). Always send a real one. */
const UA = "mautomate-editor/1.0"

type Kind =
  | "logo"
  | "hero"
  | "banner"
  | "product"
  | "lifestyle"
  | "background"
  | "square"
  | "portrait"

/** SDXL native aspect buckets — the model was TRAINED on these, so it composes
 *  properly for the frame instead of producing a cropped square. */
const SLOT: Record<Kind, { w: number; h: number; transparent?: boolean }> = {
  logo: { w: 1024, h: 1024, transparent: true },
  hero: { w: 1344, h: 768 },
  banner: { w: 1536, h: 640 },
  product: { w: 1024, h: 1024 },
  lifestyle: { w: 1216, h: 832 },
  background: { w: 1536, h: 640 },
  square: { w: 1024, h: 1024 },
  portrait: { w: 832, h: 1216 },
  // Internal: the empty stage a composed banner is built on. Not slot-detected.
  scene: { w: 1536, h: 640 },
}

const NEG_BASE =
  "text, words, letters, watermark, signature, logo, caption, ui, frame, border, " +
  "blurry, low quality, jpeg artifacts, deformed, distorted, extra limbs, bad anatomy, " +
  "cluttered, messy, busy background, oversaturated"

/** Prompt scaffolding per slot — this, not the API call, is the quality. */
const RECIPE: Record<Kind, { pre: string; post: string; neg: string; steps: number; cfg: number }> = {
  logo: {
    pre: "professional minimal vector logo mark of",
    post:
      ", flat vector, simple geometric shapes, bold clean silhouette, centered, " +
      "single solid colour on a pure flat white background, high contrast, no gradients, no 3d, iconic, memorable",
    neg: NEG_BASE + ", photo, photorealistic, texture, shadow, gradient, mockup, business card, 3d render, cluttered detail",
    steps: 30,
    cfg: 7.5,
  },
  hero: {
    pre: "wide cinematic hero banner photograph of",
    post:
      ", editorial e-commerce photography, generous negative space on one side for headline text, " +
      "soft natural light, shallow depth of field, premium brand feel, sharp focus",
    neg: NEG_BASE + ", collage, split screen, tiny subject",
    steps: 28,
    cfg: 7,
  },
  banner: {
    pre: "ultra wide promotional banner background of",
    post:
      ", clean composition, large empty area for overlaid text, soft even lighting, " +
      "subtle depth, premium retail campaign look",
    neg: NEG_BASE + ", busy pattern, centered subject blocking text area",
    steps: 26,
    cfg: 7,
  },
  product: {
    pre: "professional e-commerce product photograph of",
    post:
      ", isolated on a seamless pure white studio background, soft diffused three-point studio lighting, " +
      "subtle contact shadow, crisp detail, catalogue quality, centered, full product visible",
    neg: NEG_BASE + ", hands, people, props, scene, outdoor, dark background, cropped product",
    steps: 30,
    cfg: 7.5,
  },
  lifestyle: {
    pre: "lifestyle brand photograph of",
    post:
      ", natural window light, authentic candid moment, warm inviting tones, real environment, " +
      "shallow depth of field, editorial magazine quality",
    neg: NEG_BASE + ", studio white background, cut out, stock photo cheesy",
    steps: 28,
    cfg: 7,
  },
  background: {
    // NOT "abstract gradient, out of focus" — that produced a pink blur. A
    // backdrop must still be a real, photographed surface with depth; it is just
    // uncluttered enough to put a product or a headline on top of.
    pre: "professional photographic backdrop:",
    post:
      ", real surface with authentic texture and depth, soft directional studio light, " +
      "gentle falloff and shadow, uncluttered, generous empty space, premium editorial " +
      "product-photography backdrop, sharp and clean",
    neg:
      NEG_BASE +
      ", product, object, person, subject in frame, abstract gradient, blurry mush, " +
      "rainbow colours, neon, busy pattern",
    steps: 28,
    cfg: 7,
  },
  square: {
    pre: "clean square photograph of",
    post: ", well composed, centered subject, soft light, premium quality, sharp focus",
    neg: NEG_BASE,
    steps: 28,
    cfg: 7,
  },
  portrait: {
    pre: "vertical portrait photograph of",
    post: ", natural light, shallow depth of field, premium editorial quality, sharp focus",
    neg: NEG_BASE,
    steps: 28,
    cfg: 7,
  },
  scene: {
    // For compositing. CRITICAL: never say "backdrop"/"studio" as a noun — the
    // model renders the equipment. Describe an empty advertising SCENE and ban
    // the gear explicitly in the negative prompt.
    pre: "empty advertising scene:",
    post:
      ", completely empty scene with no products and no objects in frame, clean simple surface, " +
      "generous negative space, soft directional light from one side, gentle shadow falloff, " +
      "premium commerce campaign environment, sharp focus",
    neg:
      NEG_BASE +
      ", photography studio equipment, softbox, light stand, tripod, umbrella, camera, " +
      "backdrop stand, reflector, person, product, object in frame, abstract gradient",
    steps: 28,
    cfg: 7,
  },
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function novita(path: string, body: unknown, key: string): Promise<any> {
  const r = await fetch(`${NOVITA}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "User-Agent": UA,
    },
    body: JSON.stringify(body),
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j?.message || j?.reason || `provider ${r.status}`)
  return j
}

/** Submit txt2img and poll to completion. Returns image URLs. */
async function generate(
  key: string,
  kind: Kind,
  prompt: string,
  count: number,
  extraNeg = ""
): Promise<string[]> {
  const slot = SLOT[kind]
  const rec = RECIPE[kind]
  const full = `${rec.pre} ${prompt}${rec.post}`
  const neg = extraNeg ? `${rec.neg}, ${extraNeg}` : rec.neg

  const task = await novita(
    "/async/txt2img",
    {
      extra: { response_image_type: "png" },
      request: {
        model_name: MODEL(),
        prompt: full,
        negative_prompt: neg,
        width: slot.w,
        height: slot.h,
        image_num: Math.max(1, Math.min(4, count)),
        steps: rec.steps,
        seed: -1,
        guidance_scale: rec.cfg, // REQUIRED by Novita — omitting it is a 400.
        sampler_name: "DPM++ 2M Karras",
      },
    },
    key
  )
  const id = task?.task_id
  if (!id) throw new Error("The image service did not accept the request.")

  for (let i = 0; i < 40; i++) {
    await sleep(2500)
    const r = await fetch(`${NOVITA}/async/task-result?task_id=${id}`, {
      headers: { Authorization: `Bearer ${key}`, "User-Agent": UA },
    })
    const j: any = await r.json().catch(() => ({}))
    const st = j?.task?.status
    if (st === "TASK_STATUS_SUCCEED") {
      const urls = (j.images ?? []).map((im: any) => im.image_url).filter(Boolean)
      if (!urls.length) throw new Error("No images were returned.")
      return urls
    }
    if (st === "TASK_STATUS_FAILED") {
      throw new Error(j?.task?.reason || "Image generation failed.")
    }
  }
  throw new Error("Image generation timed out.")
}

async function fetchB64(url: string): Promise<{ b64: string; bytes: Buffer }> {
  const r = await fetch(url, { headers: { "User-Agent": UA } })
  if (!r.ok) throw new Error(`could not fetch image (${r.status})`)
  const buf = Buffer.from(await r.arrayBuffer())
  return { b64: buf.toString("base64"), bytes: buf }
}

/** Remove background from an in-memory image; returns transparent PNG buffer. */
async function removeBgFromB64(key: string, b64: string): Promise<Buffer> {
  const j = await novita("/remove-background", { image_file: b64, extra: { response_image_type: "png" } }, key)
  const out = j?.image_file || j?.image || j?.images?.[0]?.image_file
  if (!out) throw new Error("Background removal returned nothing.")
  return Buffer.from(out, "base64")
}

/** Novita remove-background: base64 in, base64 PNG out (transparent). */
async function removeBg(key: string, url: string): Promise<string> {
  const { b64 } = await fetchB64(url)
  const j = await novita("/remove-background", { image_file: b64, extra: { response_image_type: "png" } }, key)
  const out = j?.image_file || j?.image || j?.images?.[0]?.image_file
  if (!out) throw new Error("Background removal returned nothing.")
  return `data:image/png;base64,${out}`
}

/**
 * The text boxes are DESCRIPTIONS the image model paints literally — but users
 * type INSTRUCTIONS ("separate the watch from this image and make a banner").
 * Painting an instruction hallucinates its nouns into the scene (a user's
 * "watch" became a fake gold watch in their banner). This gate catches
 * instruction-like text and has the LLM either (a) distil a clean scene
 * description from it, or (b) return an honest, helpful refusal when the user
 * asks for something the tool cannot do — instead of silently making garbage.
 */
const INSTRUCTIONY =
  /\b(seperate|separate|extract|isolate|remove|cut\s*-?\s*outs?|crop|split|from\s+(the|this|that|my)\s+(image|photo|picture)|(this|that|my)\s+(image|photo|picture)|make\s+(a|an|me)?\s*(image|photo|banner|logo)|edit|change\s+the|(this|that)\s+(man|woman|boy|girl|person|guy|kid|child|lady|model|face|product|item|one)|(make|makes|made|turn|show)\s+(this|that|it|him|her)\b|\bvisible\b)\b/i

async function interpretText(
  key: string,
  text: string,
  mode: "compose" | "generate",
  nSubjects: number,
  hasCurrent = false
): Promise<{ scene: string | null; cannot: string | null }> {
  if (!INSTRUCTIONY.test(text)) return { scene: text, cannot: null }
  const caps =
    mode === "compose"
      ? `The tool takes the user's ALREADY UPLOADED images (they provided ${nSubjects}), cuts each WHOLE image off its background, and places them on a newly generated background scene. It CANNOT: extract or separate individual objects from inside one photo, edit or modify the user's photos, or add real products it was not given as separate images. If they want individual items, they must upload one photo per item.`
      : `This mode creates a brand-new image purely from a text description; it cannot see or use existing images. ${
          hasCurrent
            ? `HOWEVER, this studio also has an "Edit current" option (a tab above the text box) that CAN restyle the image currently in the field — it keeps the composition and changes the look/lighting/mood, but cannot reveal things outside the frame, add objects, or make precise object-level edits. When the user wants to restyle/relight their current image, tell them to switch to "Edit current". When they want content that is not in the frame (e.g. a face that is cropped out), tell them to describe the complete new image from scratch here instead.`
            : `There is no current image in this field, so editing is not applicable — suggest describing the complete image they want from scratch.`
        }`
  try {
    const r = await fetch("https://api.novita.ai/v3/openai/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({
        model: process.env.NOVITA_TEXT_MODEL || process.env.NOVITA_MODEL || "moonshotai/kimi-k2.7-code",
        max_tokens: 220,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              `You triage text a user typed into an image-generation box. ${caps}\n` +
              `Reply JSON {"scene": string|null, "cannot": string|null}.\n` +
              `- If the text asks for something the tool CANNOT do (editing/referencing an existing image, separating objects out of a photo), set "cannot" to a short friendly explanation of why and what to do instead — for image-edit requests, suggest describing the COMPLETE image they want from scratch (max 2 sentences). Set "scene" null.\n` +
              (mode === "compose"
                ? `- Otherwise set "scene" to a clean BACKGROUND-SCENE description distilled from their text: surroundings, surface and lighting ONLY — never product nouns (watch, earbuds, shoes, etc.), never verbs like make/create. If they gave no usable scene, set "scene" null.`
                : `- Otherwise set "scene" to a clean FULL-IMAGE description distilled from their text: keep the subject and setting, drop instruction verbs (make/create/edit). If nothing usable remains, set "scene" null.`),
          },
          { role: "user", content: text },
        ],
      }),
    })
    const body: any = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error("interpret failed")
    const parsed = JSON.parse(body?.choices?.[0]?.message?.content ?? "{}")
    return {
      scene: typeof parsed.scene === "string" && parsed.scene.trim() ? parsed.scene.trim().slice(0, 300) : null,
      cannot: typeof parsed.cannot === "string" && parsed.cannot.trim() ? parsed.cannot.trim().slice(0, 300) : null,
    }
  } catch {
    // Interpreter unavailable: fail SAFE for instruction-like text — better a
    // neutral default scene than the user's instruction painted literally.
    return { scene: null, cannot: null }
  }
}

const VISION_MODEL = () => process.env.NOVITA_VISION_MODEL || "qwen/qwen3-vl-30b-a3b-instruct"
const TEXT_MODEL = () => process.env.NOVITA_TEXT_MODEL || process.env.NOVITA_MODEL || "moonshotai/kimi-k2.7-code"

async function chatJSON(
  key: string,
  model: string,
  messages: any[],
  maxTokens: number,
  json = false
): Promise<any> {
  const r = await fetch("https://api.novita.ai/v3/openai/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0,
      messages,
      ...(json ? { response_format: { type: "json_object" } } : null),
    }),
  })
  const body: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body?.error?.message || `llm ${r.status}`)
  const out = body?.choices?.[0]?.message?.content ?? ""
  // Some models fence JSON in markdown even in JSON mode — strip defensively.
  return json ? String(out).replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "") : out
}

/**
 * Edit requests split into two real capabilities:
 *  - RESTYLE (img2img): lighting, mood, colour, style — same pixels reshaped.
 *  - RECREATE (vision + txt2img): content changes — reveal a face, add/remove
 *    things, show more of the scene. img2img cannot do these (it repaints the
 *    same frame), so instead a vision model DESCRIBES the photo and we generate
 *    the complete new shot with the user's change applied. Honest note attached:
 *    the person/scene is AI-generated, not the original.
 */
async function classifyEdit(
  key: string,
  instruction: string
): Promise<"restyle" | "scene" | "recreate"> {
  // Deterministic keyword routing FIRST — the same prompt must always take the
  // same path (the LLM tie-breaker was observed flipping scene->restyle between
  // identical calls). LLM only for genuinely ambiguous text.
  const t = instruction.toLowerCase()
  if (/\b(background|backdrop|surroundings|scene behind|place (it|this|them)|put (it|this|them) (on|in|at)|environment)\b/.test(t)) {
    return "scene"
  }
  if (/\b(face|visible|reveal|show (his|her|the|their|more|whole|full)|add|remove|extend|whole body|full body)\b/.test(t)) {
    return "recreate"
  }
  if (/\b(light|lighting|mood|tone|colou?r|style|warm|cool|bright|dark|premium|vintage|look)\b/.test(t) && !/\b(background|scene)\b/.test(t)) {
    return "restyle"
  }
  try {
    const raw = await chatJSON(key, TEXT_MODEL(), [
      {
        role: "system",
        content:
          'Classify an image-edit request. Reply JSON {"kind":"restyle"|"scene"|"recreate"}.\n' +
          '"restyle" = only look/lighting/mood/colour/style of the whole picture changes. Examples: "warm sunset light", "make it look premium", "dark moody feel".\n' +
          '"scene" = the SUBJECT/PRODUCT must stay exactly the same but the BACKGROUND/SURROUNDINGS change. Examples: "put it on a marble table", "change the background to a beach", "place it in a modern kitchen".\n' +
          '"recreate" = the SUBJECT itself must change or show something the photo does not contain: revealing or adding a face, showing more of the body, adding or removing objects. Examples: "make his face visible", "show the whole person", "remove the box".',
      },
      { role: "user", content: instruction },
    ], 500, true)
    const k = JSON.parse(raw)?.kind
    return k === "recreate" ? "recreate" : k === "scene" ? "scene" : "restyle"
  } catch {
    return "restyle"
  }
}

async function captionImage(key: string, jpegB64: string): Promise<string> {
  const raw = await chatJSON(key, VISION_MODEL(), [
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpegB64}` } },
        {
          type: "text",
          text:
            "Describe WHAT is in this photo in ONE detailed sentence: the subject, clothing, held objects, setting and lighting. " +
            "Do NOT mention camera framing, cropping, close-up, or which body parts are visible or cut off. No preamble.",
        },
      ],
    },
  ], 500)
  return String(raw).trim().replace(/^"|"$/g, "")
}

/**
 * Composite REAL images — the merchant's products, library photos or uploads —
 * onto a generated scene. Up to 4 subjects, each background-removed, arranged
 * along a COMMON GROUND LINE (bottom-aligned at ~85% height) so they stand ON
 * the scene like a real campaign shot instead of floating in it, each with a
 * soft shadow built from its own alpha.
 */
async function composeBanner(
  key: string,
  kind: Kind,
  subjectUrls: string[],
  scenePrompt: string,
  layout: "left" | "right" | "center"
): Promise<string> {
  const slot = SLOT[kind]
  const urls = subjectUrls.slice(0, 4)

  // 1. Cut every subject out of its background (in parallel).
  const cuts = await Promise.all(
    urls.map(async (u) => {
      const dataUri = await removeBg(key, u)
      return Buffer.from(dataUri.split(",")[1], "base64")
    })
  )

  // 2. Scene at the banner's exact size — subject-free and uncluttered.
  // "make a banner" describes the task, not the scene — scrub meta-words, and
  // if nothing meaningful is left, fall back to a safe premium default.
  const cleaned = scenePrompt
    .replace(/\b(make|create|build|generate|design)\b/gi, " ")
    .replace(/\b(a|an|the|me|my|please)\b/gi, " ")
    .replace(/\b(banner|hero|image|picture|photo|ad|advert|advertisement)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  const sceneDesc = cleaned.length >= 6 ? cleaned : "clean minimal premium surface, soft warm light"
  const [bgUrl] = await generate(key, "scene", sceneDesc as any, 1)
  const bgRes = await fetch(bgUrl, { headers: { "User-Agent": UA } })
  const bg = sharp(Buffer.from(await bgRes.arrayBuffer())).resize(slot.w, slot.h, { fit: "cover" })

  // 3. Subjects share a zone; slight center emphasis so the lineup reads as a
  //    styled arrangement rather than a row of stickers.
  const n = cuts.length
  const pad = Math.round(slot.w * 0.05)
  const zoneW = Math.round(slot.w * (layout === "center" ? 0.72 : n > 1 ? 0.6 : 0.42))
  const zoneX =
    layout === "left" ? pad : layout === "right" ? slot.w - zoneW - pad : Math.round((slot.w - zoneW) / 2)
  const heightFrac = n === 1 ? 0.72 : n === 2 ? 0.62 : n === 3 ? 0.54 : 0.48
  const emphasis = n === 1 ? [1] : n === 2 ? [1, 0.9] : n === 3 ? [0.88, 1, 0.88] : [0.82, 0.95, 0.95, 0.82]
  const ground = Math.round(slot.h * 0.85)
  const cellW = Math.floor(zoneW / n)

  const layers: any[] = []
  for (let i = 0; i < n; i++) {
    let tight = cuts[i]
    try {
      // Trim the transparent border so sizing works on the subject itself.
      tight = await sharp(cuts[i]).trim().png().toBuffer()
    } catch {
      /* fully-opaque edge case — use as-is */
    }
    const prod = await sharp(tight)
      .resize({
        width: Math.floor(cellW * 0.98),
        height: Math.floor(slot.h * heightFrac * emphasis[i]),
        fit: "inside",
        withoutEnlargement: false,
      })
      .png()
      .toBuffer()
    const meta = await sharp(prod).metadata()
    const pw = meta.width ?? cellW
    const ph = meta.height ?? 100
    const left = zoneX + i * cellW + Math.round((cellW - pw) / 2)
    const top = ground - ph

    const alphaC = await sharp(prod).ensureAlpha().extractChannel("alpha").blur(20).linear(0.38, 0).toBuffer()
    const shadow = await sharp({
      create: { width: pw, height: ph, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .joinChannel(alphaC)
      .png()
      .toBuffer()
    layers.push({ input: shadow, left: left + Math.round(pw * 0.02), top: top + Math.round(ph * 0.05) })
    layers.push({ input: prod, left, top })
  }

  const out = await bg.composite(layers).png().toBuffer()
  return `data:image/png;base64,${out.toString("base64")}`
}

const GEMINI_MODEL = () => process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image"
const GEMINI_ASPECT: Record<string, string> = {
  hero: "16:9",
  banner: "21:9",
  background: "16:9",
  lifestyle: "4:3",
  portrait: "3:4",
  product: "1:1",
  square: "1:1",
  logo: "1:1",
}

/**
 * Identical request twice = the same $0.04 paid twice. Cache recent Gemini
 * results by request hash (per tenant) for an hour — double-clicks and
 * accidental re-runs become free.
 */
const geminiCache = new Map<string, { url: string; ts: number }>()
const GEMINI_CACHE_TTL = 60 * 60 * 1000
function geminiCacheKey(tenantId: string, payload: unknown): string {
  return crypto.createHash("sha256").update(tenantId + JSON.stringify(payload)).digest("hex")
}
function geminiCacheGet(k: string): string | null {
  const hit = geminiCache.get(k)
  if (hit && Date.now() - hit.ts < GEMINI_CACHE_TTL) return hit.url
  if (hit) geminiCache.delete(k)
  return null
}
function geminiCachePut(k: string, url: string) {
  if (geminiCache.size > 500) {
    const oldest = [...geminiCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]
    if (oldest) geminiCache.delete(oldest[0])
  }
  geminiCache.set(k, { url, ts: Date.now() })
}

/**
 * Nano banana (Gemini image model) — the PRIMARY engine when a key is present.
 * Unlike the SD pipeline it does subject-consistent editing natively: give it
 * the product photo and "a person holding this product" and it renders the
 * EXACT product in the new scene. Returns null on any failure (no credits,
 * quota, safety block) so callers fall back to the old pipeline gracefully.
 */
async function geminiImage(parts: any[], aspect?: string): Promise<Buffer | null> {
  const gkey = process.env.GEMINI_API_KEY
  if (!gkey) return null
  try {
    const body: any = { contents: [{ parts }] }
    if (aspect) body.generationConfig = { imageConfig: { aspectRatio: aspect } }
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL()}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": gkey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000),
      }
    )
    const d: any = await r.json().catch(() => ({}))
    if (!r.ok) {
      console.log(`[ai-image] gemini ${r.status}: ${String(d?.error?.message ?? "").slice(0, 140)}`)
      return null
    }
    for (const p of d?.candidates?.[0]?.content?.parts ?? []) {
      if (p?.inlineData?.data) return Buffer.from(p.inlineData.data, "base64")
    }
    console.log("[ai-image] gemini returned no image part")
    return null
  } catch (e: any) {
    console.log(`[ai-image] gemini error: ${String(e?.message ?? e).slice(0, 140)}`)
    return null
  }
}

async function urlToInlinePart(url: string): Promise<any> {
  if (url.startsWith("data:")) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(url)
    if (!m) throw new Error("bad image data")
    return { inline_data: { mime_type: m[1], data: m[2] } }
  }
  const r = await fetch(url, { headers: { "User-Agent": UA } })
  if (!r.ok) throw new Error(`could not fetch image (${r.status})`)
  const mime = r.headers.get("content-type")?.split(";")[0] || "image/png"
  const buf = Buffer.from(await r.arrayBuffer())
  return { inline_data: { mime_type: mime, data: buf.toString("base64") } }
}

const GEMINI_ASPECTS: [string, number][] = [
  ["1:1", 1], ["2:3", 2 / 3], ["3:2", 3 / 2], ["3:4", 3 / 4], ["4:3", 4 / 3],
  ["4:5", 4 / 5], ["5:4", 5 / 4], ["9:16", 9 / 16], ["16:9", 16 / 9], ["21:9", 21 / 9],
]
/** Gemini only supports 10 aspect ratios — pick the closest, we crop to exact. */
function closestAspect(w: number, h: number): string {
  const r = w / h
  return GEMINI_ASPECTS.reduce((best, cur) =>
    Math.abs(Math.log(cur[1] / r)) < Math.abs(Math.log(best[1] / r)) ? cur : best
  )[0]
}
/** Merchant-typed dimensions, clamped sane. */
function customDims(b: Record<string, any>): { w: number; h: number } | null {
  const w = Math.round(Number(b.width)), h = Math.round(Number(b.height))
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 64 || h < 64 || w > 4096 || h > 4096) return null
  return { w, h }
}
/** Cover-crop to the EXACT requested pixels — "any size" is real, not approximate. */
async function toExactSize(buf: Buffer, dims: { w: number; h: number } | null): Promise<Buffer> {
  if (!dims) return buf
  return await sharp(buf).resize(dims.w, dims.h, { fit: "cover" }).png().toBuffer()
}
/** Logos must be edge-to-edge: trim the transparent border to the mark's
 *  bounding box. Deterministic — prompting alone never guarantees it. */
async function trimTransparent(buf: Buffer): Promise<Buffer> {
  try {
    return await sharp(buf).trim().png().toBuffer()
  } catch {
    return buf
  }
}

const KEEP_PRODUCT =
  "CRITICAL: keep every product from the reference image(s) EXACTLY identical — same design, shape, colors, materials, logos, text and details. Do not redesign or reinterpret the product in any way."

/** Store a finished image immediately and return its permanent URL — results
 *  must never travel as multi-MB data URIs (JSON body limit 413s the save). */
/**
 * Store a generated image AND put it in the merchant's media library.
 *
 * It used to only upload the bytes and hand back a URL. The file existed in
 * storage, the URL worked — and the library never heard about it, because the
 * library is a CATALOGUE (`cms_media` rows), not a directory listing. So every
 * AI image a merchant paid credits to generate vanished the moment they closed
 * the dialog: unfindable, unreusable, and impossible to put on a second page.
 *
 * Cataloguing is best-effort: if the row cannot be written we still return the
 * URL, because losing the picture the merchant just paid for would be worse than
 * losing its library entry.
 */
async function storeImage(
  scope: any,
  tenantId: string,
  name: string,
  buf: Buffer,
  mime = "image/png"
): Promise<string> {
  const { result } = await uploadFilesWorkflow(scope).run({
    input: {
      files: [
        {
          filename: `${tenantId}/${name}`,
          mimeType: mime,
          content: buf.toString("base64"),
          access: "public",
        },
      ],
    },
  })
  const file = (result as any)?.[0]
  const url = file?.url
  if (!url) throw new Error("Could not store the image.")

  try {
    const cms: any = scope.resolve(CMS_MODULE)
    let width: number | null = null
    let height: number | null = null
    try {
      const meta = await sharp(buf).metadata()
      width = meta.width ?? null
      height = meta.height ?? null
    } catch {
      // Dimensions are a nicety; never lose the catalogue row over them.
    }
    await cms.createCmsMedias([
      {
        tenant_id: tenantId,
        file_id: file.id ?? null,
        url,
        original_filename: name,
        filename: name,
        mime_type: mime,
        size: buf.length,
        width,
        height,
        checksum: crypto.createHash("sha256").update(buf).digest("hex"),
        alt: null,
        title: null,
        folder_id: null,
        created_by: "ai",
      },
    ])
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error(
      `[ai-image] stored ${name} but could not catalogue it: ${e?.message ?? e}`
    )
  }

  return url
}

async function storePng(scope: any, tenantId: string, name: string, png: Buffer): Promise<string> {
  return await storeImage(scope, tenantId, name, png, "image/png")
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
  if (!key) return res.status(503).json({ error: "Image generation is not configured." })

  const b = (req.body ?? {}) as Record<string, any>
  const action = b.action === "save" ? "save" : "generate"

  // Trials get a generous but finite number of images — enough to fall in love
  // with the product, not enough to cost us $30 before they ever pay.
  if (action !== "save") {
    const quota = await checkImageQuota(req.scope, tenantId)
    if (!quota.allowed) {
      return res.status(402).json({ error: quota.reason, upgrade_to: quota.upgrade_to })
    }
  }

  // ---- credit metering: reserve before spending vendor money, commit on
  // success, release on failure. Cached results and refusals stay free
  // (ok() commits only when a reservation exists). ----
  const ledger = getLedger(req.scope)
  let creditRid: string | null = null
  const gate = async (act: BillableAction): Promise<boolean> => {
    creditRid = `cres_ai_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const r = await ledger.reserve(tenantId, act, 1, { reservationId: creditRid })
    if (!r.ok) creditRid = null
    return r.ok
  }
  const ok = (payload: Record<string, any>) => {
    if (creditRid) ledger.commit(creditRid).catch(() => {})
    return res.json(payload)
  }
  const outOfCredits = (act: BillableAction) =>
    res.status(402).json({
      error: `You're out of AI credits (this needs ${creditsFor(act)}). Top up in Billing.`,
    })

  try {
    /* ---------------- SAVE: store the chosen image permanently ---------------- */
    if (action === "save") {
      const src = typeof b.url === "string" ? b.url : ""
      if (!src) return res.status(400).json({ error: "url required" })
      // Already stored by compose/scene-swap — nothing to do.
      if (src.includes("/static/") && src.includes(tenantId)) {
        return ok({ url: src })
      }

      let b64: string
      let mime = "image/png"
      if (src.startsWith("data:")) {
        const m = /^data:([^;]+);base64,(.+)$/.exec(src)
        if (!m) return res.status(400).json({ error: "bad image data" })
        mime = m[1]
        b64 = m[2]
      } else {
        const got = await fetchB64(src)
        b64 = got.b64
        mime = src.includes(".jpeg") || src.includes(".jpg") ? "image/jpeg" : "image/png"
      }

      const ext = mime === "image/jpeg" ? "jpg" : "png"
      const name = `ai-${b.kind || "image"}-${Date.now()}.${ext}`
      // Route through storeImage so the picture lands in the LIBRARY, not just in
      // the bucket. This path is the "save" the merchant explicitly asked for —
      // it was the one place that skipped the catalogue entirely.
      const url = await storeImage(
        req.scope,
        tenantId,
        name,
        Buffer.from(b64, "base64"),
        mime
      )

      return ok({ url })
    }

    /* ---------------- COMPOSE: real product + generated scene ---------------- */
    /* ---------------- REMIX: img2img on an existing image ---------------- */
    // Re-imagines the look of the CURRENT image while keeping its composition.
    // This is a global re-paint, not surgical editing — the UI says so.
    if (b.action === "remix") {
      const src = typeof b.image === "string" ? b.image : ""
      const instruction = typeof b.prompt === "string" ? b.prompt.slice(0, 400).trim() : ""
      if (!src) return res.status(400).json({ error: "No image to edit." })
      if (!instruction) return res.status(400).json({ error: "Describe the change you want." })
      const strength = Math.min(0.85, Math.max(0.25, Number(b.strength) || 0.55))

      // Normalise a COPY of the source for SDXL: long side <= 1024, dims /8.
      let buf: Buffer
      if (src.startsWith("data:")) {
        const m = /^data:[^;]+;base64,(.+)$/.exec(src)
        if (!m) return res.status(400).json({ error: "bad image data" })
        buf = Buffer.from(m[1], "base64")
      } else {
        if (!/^https?:\/\//.test(src)) {
          return res.status(400).json({ error: "This image's address is relative and can't be reached from the server. Try picking it from the media library instead." })
        }
        const rr = await fetch(src, { headers: { "User-Agent": UA } })
        if (!rr.ok) return res.status(400).json({ error: "could not read the image" })
        buf = Buffer.from(await rr.arrayBuffer())
      }
      const meta = await sharp(buf).metadata()
      const ow = meta.width ?? 1024
      const oh = meta.height ?? 1024
      const scale = Math.min(1, 1024 / Math.max(ow, oh))
      const tw = Math.max(64, Math.round((ow * scale) / 8) * 8)
      const th = Math.max(64, Math.round((oh * scale) / 8) * 8)
      const norm = await sharp(buf).resize(tw, th, { fit: "fill" }).png().toBuffer()

      // Nano banana first: one natural-language edit with exact product
      // consistency — the thing the SD pipeline could never guarantee.
      const ck1 = geminiCacheKey(tenantId, ["remix", src, instruction, b.kind ?? ""])
      const cached1 = geminiCacheGet(ck1)
      if (cached1) return ok({ images: [cached1], remix: true, engine: "gemini", cached: true })
      if (!(await gate("ai_image"))) return outOfCredits("ai_image")
      // Priority: merchant-typed exact size > selected shape > source shape.
      const editDims = customDims(b)
      const targetKind = typeof b.kind === "string" && GEMINI_ASPECT[b.kind] ? b.kind : null
      const editAspect = editDims
        ? closestAspect(editDims.w, editDims.h)
        : targetKind
        ? GEMINI_ASPECT[targetKind]
        : th > tw ? "3:4" : tw > th * 1.5 ? "16:9" : "1:1"
      const gEdit = await geminiImage(
        [
          { inline_data: { mime_type: "image/png", data: norm.toString("base64") } },
          {
            text: `${instruction}. ${KEEP_PRODUCT} Professional e-commerce marketing quality.${
              targetKind ? ` Compose the result as a ${targetKind} format image (${editAspect} aspect ratio).` : ""
            }`,
          },
        ],
        editAspect
      )
      if (gEdit) {
        const url = await storePng(req.scope, tenantId, `ai-edit-${Date.now()}.png`, await toExactSize(gEdit, editDims))
        geminiCachePut(ck1, url)
        return ok({ images: [url], remix: true, engine: "gemini" })
      }


      if (process.env.ALLOW_SD_FALLBACK !== "1") {
        if (creditRid) await ledger.release(creditRid).catch(() => {})
        return res.status(502).json({ error: "The image engine is busy right now — please try again in a moment." })
      }

      const editKind = await classifyEdit(key, instruction)
      console.log(`[ai-image] remix classified as: ${editKind}`)

      // Scene swap: the subject must stay EXACT. Inpainting invents the new
      // surroundings, then the ORIGINAL subject pixels are composited back on
      // top — the model never gets the final say over the product (measured:
      // even "preserved" inpaint regions drift ~22/255 without this paste-back).
      if (editKind === "scene") {
        const cut = await removeBgFromB64(key, norm.toString("base64"))
        const cutSized = await sharp(cut).resize(tw, th, { fit: "fill" }).png().toBuffer()
        const alphaRaw = await sharp(cutSized).ensureAlpha().extractChannel("alpha").raw().toBuffer()
        const mask = await sharp(alphaRaw, { raw: { width: tw, height: th, channels: 1 } })
          .negate()
          .blur(2)
          .png()
          .toBuffer()

        const task2 = await novita(
          "/async/inpainting",
          {
            extra: { response_image_type: "png" },
            request: {
              model_name: process.env.NOVITA_INPAINT_MODEL || "realisticVisionV40_v40VAE-inpainting_81543.safetensors",
              prompt: `${instruction}, rich detailed environment, depth and soft shadows, premium editorial product photography, soft directional light, sharp focus`,
              negative_prompt: NEG_BASE + ", person, hands",
              image_base64: norm.toString("base64"),
              mask_image_base64: mask.toString("base64"),
              steps: 25,
              image_num: 1,
              seed: -1,
              guidance_scale: 7,
              sampler_name: "DPM++ 2M Karras",
              strength: 1.0,
              width: tw,
              height: th,
            },
          },
          key
        )
        const id2 = task2?.task_id
        if (!id2) throw new Error("The image service did not accept the request.")
        let bgOut: Buffer | null = null
        for (let i = 0; i < 40; i++) {
          await sleep(2500)
          const r3 = await fetch(`${NOVITA}/async/task-result?task_id=${id2}`, {
            headers: { Authorization: `Bearer ${key}`, "User-Agent": UA },
          })
          const j3: any = await r3.json().catch(() => ({}))
          const st3 = j3?.task?.status
          if (st3 === "TASK_STATUS_SUCCEED") {
            const u3 = j3?.images?.[0]?.image_url
            if (u3) {
              const rr3 = await fetch(u3, { headers: { "User-Agent": UA } })
              bgOut = Buffer.from(await rr3.arrayBuffer())
            }
            break
          }
          if (st3 === "TASK_STATUS_FAILED") throw new Error(j3?.task?.reason || "Scene generation failed.")
        }
        if (!bgOut) throw new Error("Scene generation timed out.")

        // Paste the true subject pixels back over the generated scene — with
        // the alpha edge pulled 1-2px INWARD and feathered, so the cut-out
        // melts into the new background instead of leaving a halo ring.
        const feathered = await sharp(alphaRaw, { raw: { width: tw, height: th, channels: 1 } })
          .blur(1.4)
          .linear(1.5, -60) // pull the soft edge inward, keep the core solid
          .toColourspace("b-w") // blur/linear promote to 3 channels — force back to 1
          .raw()
          .toBuffer()
        const rgb = await sharp(cutSized).removeAlpha().raw().toBuffer()
        const subject = await sharp(rgb, { raw: { width: tw, height: th, channels: 3 } })
          .joinChannel(feathered, { raw: { width: tw, height: th, channels: 1 } })
          .png()
          .toBuffer()
        const finalPng = await sharp(bgOut)
          .resize(tw, th, { fit: "fill" })
          .composite([{ input: subject }])
          .png()
          .toBuffer()

        const storedUrl = await storePng(req.scope, tenantId, `ai-scene-${Date.now()}.png`, finalPng)
        return ok({
          images: [storedUrl],
          remix: true,
          preserved: true,
          note: "Only the surroundings were regenerated — your product's pixels are copied from the original, untouched.",
          size: `${tw}x${th}`,
        })
      }

      // Content change? img2img can't add what isn't in the frame — recreate
      // the shot instead: vision model describes the photo, txt2img generates
      // the complete new image with the user's change applied.
      if (editKind === "recreate") {
        const small = await sharp(buf).resize(768, 768, { fit: "inside" }).jpeg({ quality: 82 }).toBuffer()
        const caption = await captionImage(key, small.toString("base64"))
        // Merge change-FIRST: the requested change leads the prompt (SDXL
        // weights early tokens hardest), and failures of the change go into
        // the negative prompt ("cropped head" etc).
        let genPrompt = `${instruction}. ${caption}`
        let extraNeg = ""
        try {
          const raw = await chatJSON(key, TEXT_MODEL(), [
            {
              role: "system",
              content:
                'Combine a photo description and a requested change into ONE image-generation prompt that fully applies the change. ' +
                'Reply JSON {"prompt": string, "negative": string}. Rules: the change comes FIRST and explicitly (e.g. "portrait of a young man with his face clearly visible, smiling at the camera, ..."); keep the description\u0027s subject, clothing, objects, setting; "negative" lists what would mean the change FAILED (e.g. "cropped head, face out of frame, headless, back view").',
            },
            { role: "user", content: `Description: ${caption}\nRequested change: ${instruction}` },
          ], 800, true)
          const merged = JSON.parse(raw)
          if (typeof merged?.prompt === "string" && merged.prompt.trim()) genPrompt = merged.prompt.trim().slice(0, 500)
          if (typeof merged?.negative === "string") extraNeg = merged.negative.trim().slice(0, 200)
        } catch {
          /* fall back to change-first concatenation */
        }
        const genKind: Kind = th > tw ? "portrait" : tw > th * 1.5 ? "hero" : "square"
        const urls = await generate(key, genKind, genPrompt, 1, extraNeg)
        return ok({
          images: urls,
          remix: true,
          recreated: true,
          note: "This is a full AI recreation — EVERYTHING here, including any product shown, is newly generated and will differ from your real product. Use for inspiration; for exact-product images use \u0027My images\u0027 or a background-change request.",
          size: `${SLOT[genKind].w}x${SLOT[genKind].h}`,
        })
      }

      const task = await novita(
        "/async/img2img",
        {
          extra: { response_image_type: "png" },
          request: {
            model_name: MODEL(),
            prompt: `${instruction}, high quality, sharp focus`,
            negative_prompt: NEG_BASE,
            image_base64: norm.toString("base64"),
            steps: 30,
            image_num: 1,
            seed: -1,
            guidance_scale: 7.0,
            sampler_name: "DPM++ 2M Karras",
            strength,
            width: tw,
            height: th,
          },
        },
        key
      )
      const id = task?.task_id
      if (!id) throw new Error("The image service did not accept the request.")
      let images: string[] = []
      for (let i = 0; i < 40; i++) {
        await sleep(2500)
        const r2 = await fetch(`${NOVITA}/async/task-result?task_id=${id}`, {
          headers: { Authorization: `Bearer ${key}`, "User-Agent": UA },
        })
        const j: any = await r2.json().catch(() => ({}))
        const st = j?.task?.status
        if (st === "TASK_STATUS_SUCCEED") {
          images = (j.images ?? []).map((im: any) => im.image_url).filter(Boolean)
          break
        }
        if (st === "TASK_STATUS_FAILED") throw new Error(j?.task?.reason || "Editing failed.")
      }
      if (!images.length) throw new Error("Editing timed out.")
      return ok({ images, remix: true, size: `${tw}x${th}` })
    }

    if (b.action === "compose") {
      const subjectUrls: string[] = Array.isArray(b.subject_images)
        ? b.subject_images.filter((u: any) => typeof u === "string" && u).slice(0, 4)
        : typeof b.product_image === "string" && b.product_image
        ? [b.product_image]
        : []
      const scene = typeof b.prompt === "string" ? b.prompt.slice(0, 400).trim() : ""
      if (!subjectUrls.length) return res.status(400).json({ error: "Add at least one product or image." })
      if (!scene) return res.status(400).json({ error: "Describe the scene behind your images." })
      const ck: Kind = (SLOT as any)[b.kind] ? (b.kind as Kind) : "hero"
      const layout = b.layout === "left" || b.layout === "center" ? b.layout : "right"

      const interp = await interpretText(key, scene, "compose", subjectUrls.length)
      if (interp.cannot) {
        return res.status(422).json({ error: interp.cannot })
      }
      const sceneText = interp.scene || "clean minimal premium surface, soft warm light"

      const ck2 = geminiCacheKey(tenantId, ["compose", subjectUrls, scene, layout, ck])
      const cachedC = geminiCacheGet(ck2)
      if (cachedC) {
        return ok({ images: [cachedC], kind: ck, composed: true, engine: "gemini", cached: true })
      }
      if (!(await gate("ai_image"))) return outOfCredits("ai_image")

      const gParts: any[] = []
      try {
        for (const u of subjectUrls) gParts.push(await urlToInlinePart(u))
      } catch { /* fall back below */ }
      if (gParts.length === subjectUrls.length) {
        gParts.push({
          text: `Create a professional marketing banner: ${scene}. Feature the product(s) from the reference image(s), positioned toward the ${layout} of the frame, with generous empty space for headline text. ${KEEP_PRODUCT}`,
        })
        const compDims = customDims(b)
        const gBanner = await geminiImage(gParts, compDims ? closestAspect(compDims.w, compDims.h) : GEMINI_ASPECT[ck] || "16:9")
        if (gBanner) {
          const url = await storePng(req.scope, tenantId, `ai-banner-${Date.now()}.png`, await toExactSize(gBanner, compDims))
          geminiCachePut(ck2, url)
          return ok({ images: [url], kind: ck, size: GEMINI_ASPECT[ck] || "16:9", composed: true, engine: "gemini" })
        }
      }

      if (process.env.ALLOW_SD_FALLBACK !== "1") {
        if (creditRid) await ledger.release(creditRid).catch(() => {})
        return res.status(502).json({ error: "The image engine is busy right now — please try again in a moment." })
      }
      const composedDataUri = await composeBanner(key, ck, subjectUrls, sceneText, layout)
      const composedPng = Buffer.from(composedDataUri.split(",")[1], "base64")
      const image = await storePng(req.scope, tenantId, `ai-banner-${Date.now()}.png`, composedPng)
      return ok({
        images: [image],
        kind: ck,
        size: `${SLOT[ck].w}x${SLOT[ck].h}`,
        composed: true,
      })
    }

    /* ---------------- GENERATE ---------------- */
    const kind: Kind = (SLOT as any)[b.kind] ? (b.kind as Kind) : "square"
    const prompt = typeof b.prompt === "string" ? b.prompt.slice(0, 500).trim() : ""
    if (!prompt) return res.status(400).json({ error: "Describe the image you want." })
    const count = Math.max(1, Math.min(4, Number(b.count) || 1))
    const wantTransparent = b.transparent === true || SLOT[kind].transparent === true

    const gInterp = await interpretText(key, prompt, "generate", 0, b.has_current === true)
    if (gInterp.cannot) {
      return res.status(422).json({ error: gInterp.cannot })
    }
    const promptText = gInterp.scene || prompt

    // COST ROUTING: plain text-to-image has no reference product to stay
    // faithful to, so the premium engine buys nothing here. Default to the
    // cheap SDXL path (~1/10th of a cent vs ~$0.04); GEMINI_GENERATE=1 flips
    // describe-mode onto Gemini (e.g. for premium plans).
    // ALL generation runs on Gemini (client decision: no low-quality engine).
    // ALLOW_SD_FALLBACK=1 re-enables the old SD path as an emergency valve.
    const useGemini = true
    const genAct: BillableAction = "ai_image"
    if (!(await gate(genAct))) return outOfCredits(genAct)
    const rec0 = RECIPE[kind]
    const gPrompt =
      kind === "logo"
        ? `Professional logo design: ${promptText}. Flat vector logo style, bold clean shapes, high contrast, centered on a plain pure white background with nothing else in the image. If a brand name is given, render its text EXACTLY as spelled, with clean premium typography.`
        : `${rec0.pre} ${promptText}${rec0.post}`
    const gGen = !useGemini ? null : await geminiImage([{ text: gPrompt }], GEMINI_ASPECT[kind] || "1:1")
    if (gGen) {
      let outBuf = gGen
      let transparentOut = false
      if (wantTransparent) {
        try {
          outBuf = await trimTransparent(await removeBgFromB64(key, gGen.toString("base64")))
          transparentOut = true
        } catch { /* keep flat */ }
      }
      if (!transparentOut) outBuf = await toExactSize(outBuf, customDims(b))
      const url = await storePng(req.scope, tenantId, `ai-${kind}-${Date.now()}.png`, outBuf)
      return ok({ images: [url], kind, size: GEMINI_ASPECT[kind] || "1:1", transparent: transparentOut, engine: "gemini" })
    }

    if (process.env.ALLOW_SD_FALLBACK !== "1") {
      if (creditRid) await ledger.release(creditRid).catch(() => {})
      return res.status(502).json({ error: "The image engine is busy right now — please try again in a moment." })
    }
    const urls = await generate(key, kind, promptText, count)

    // Logos (and any explicit cut-out request) come back TRANSPARENT — and
    // trimmed to the mark's bounding box, edge-to-edge with no padding.
    let images: string[] = urls
    if (wantTransparent) {
      images = await Promise.all(
        urls.map(async (u) => {
          try {
            const dataUri = await removeBg(key, u)
            const trimmed = await trimTransparent(Buffer.from(dataUri.split(",")[1], "base64"))
            // Store now — multi-MB data URIs blow the JSON limit on save.
            return await storePng(req.scope, tenantId, `ai-logo-${Date.now()}.png`, trimmed)
          } catch {
            return u
          }
        })
      )
    } else {
      const gd = customDims(b)
      if (gd) {
        // exact custom size: finish and store now (previews would mislead)
        const first = await fetch(urls[0], { headers: { "User-Agent": UA } })
        const sized = await toExactSize(Buffer.from(await first.arrayBuffer()), gd)
        const url = await storePng(req.scope, tenantId, `ai-custom-${Date.now()}.png`, sized)
        images = [url]
      }
    }

    ok({
      images,
      kind,
      size: `${SLOT[kind].w}x${SLOT[kind].h}`,
      transparent: wantTransparent,
    })
  } catch (e: any) {
    if (creditRid) await ledger.release(creditRid).catch(() => {})
    console.error("[ai-image]", String(e?.message || e).slice(0, 300))
    res.status(502).json({ error: String(e?.message || "Image generation failed").slice(0, 200) })
  }
}
