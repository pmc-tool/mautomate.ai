import type { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from "../index"
import { getAiTextProvider } from "../ai/registry"
import { getCommerceGateway } from "../gateway"
import { buildBrandContext } from "../content/brand-context"

/**
 * seo-service — the SEO + BLOG generation engine.
 *
 * A set of plain functions (not a class) that take the request `container` and
 * orchestrate the keyword → brief → article pipeline: catalog grounding (via the
 * CommerceGateway + `buildBrandContext`) + an `AiTextProvider` (via the registry)
 * + the marketing module's generated CRUD (seo-projects / keywords / briefs /
 * articles).
 *
 * DESIGN RULES (mirrors content-service):
 *   - NO-THROW on the live path: an AI outage degrades to `needs_ai` / a minimal
 *     outline, never crashes the request.
 *   - Anti-invention grounding is enforced by `buildBrandContext` (always passed
 *     as the system prompt) PLUS an explicit "only state facts about products in
 *     the grounding" rule in the article writer.
 *
 * DRAFT BODY CACHING: `marketing_blog_article` has no body/content column, so the
 * generated markdown body + meta description are cached on the SOURCE BRIEF's
 * `outline` json under `draft_body` / `draft_meta` (the brief is the single place
 * the article's content lives until it is published to the CMS). `generateArticle`
 * also RETURNS the body/meta so the caller can render it immediately, and the
 * publish route reads them back off the brief to create the CMS blog post.
 */

/** Resolve the marketing module service (generated CRUD). Typed loosely on purpose. */
const resolveMk = (container: MedusaContainer): any =>
  container.resolve(MARKETING_MODULE)

/** Coerce an unknown value into a clean list of non-empty strings. */
const toStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v.trim() : String(v ?? "").trim()))
      .filter((v) => v.length > 0)
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? [trimmed] : []
  }
  return []
}

/**
 * Best-effort JSON parse of a model response. Handles a bare object, a ```json
 * fenced block, or leading/trailing prose around a `{ ... }` object. Returns `{}`
 * when nothing parseable is found. (Copied from content-service so the SEO engine
 * stays self-contained.)
 */
const parseJsonLoose = (raw: string): Record<string, unknown> => {
  const text = (raw ?? "").trim()
  if (!text) {
    return {}
  }
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    // fall through
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim()) as Record<string, unknown>
    } catch {
      // fall through
    }
  }
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
    } catch {
      // fall through
    }
  }
  return {}
}

/** Pull a short list of catalog titles/categories to ground keyword ideas. */
const loadCatalogHints = async (
  container: MedusaContainer,
  tenantId: string
): Promise<string[]> => {
  try {
    const gateway = getCommerceGateway(container)
    const products = await gateway.queryProducts(tenantId, {
      status: "published",
      limit: 12,
    })
    return (products ?? [])
      .map((p) => (typeof p.title === "string" ? p.title.trim() : ""))
      .filter((t) => t.length > 0)
  } catch {
    // No-throw: no catalog hints simply thins the brainstorm prompt.
    return []
  }
}

// ---------------------------------------------------------------------------
// Public: suggestKeywords
// ---------------------------------------------------------------------------

/** Input for `suggestKeywords`. */
export type SuggestKeywordsInput = {
  tenantId: string
  seoProjectId?: string
  /** Seed phrase to brainstorm around (e.g. a product theme). */
  seedTerm: string
  /** How many ideas to ask for (defaults to 10, clamped 1–30). */
  count?: number
}

/** A single brainstormed keyword idea. */
export type KeywordSuggestion = {
  term: string
  intent: string | null
  /**
   * Search volume / difficulty are left NULL here: real metrics require an
   * external SEO data source. An Ahrefs `keywords-explorer` or Google Search
   * Console integration can populate `volume` / `difficulty` later without
   * changing this shape.
   */
  volume: null
  difficulty: null
}

/** Result of `suggestKeywords`. */
export type SuggestKeywordsResult = {
  keywords: KeywordSuggestion[]
  /** True when no AI provider was available (empty `keywords`). */
  needs_ai?: boolean
}

/** Normalize a raw model keyword entry into a typed suggestion. */
const normalizeKeyword = (raw: unknown): KeywordSuggestion | null => {
  if (!raw) {
    return null
  }
  if (typeof raw === "string") {
    const term = raw.trim()
    return term ? { term, intent: null, volume: null, difficulty: null } : null
  }
  if (typeof raw === "object") {
    const entry = raw as Record<string, unknown>
    const term =
      typeof entry.term === "string"
        ? entry.term.trim()
        : typeof entry.keyword === "string"
        ? entry.keyword.trim()
        : ""
    if (!term) {
      return null
    }
    const intent =
      typeof entry.intent === "string" && entry.intent.trim().length > 0
        ? entry.intent.trim()
        : null
    return { term, intent, volume: null, difficulty: null }
  }
  return null
}

/**
 * Brainstorm keyword ideas grounded in the store's catalog. Returns a list of
 * `{ term, intent, volume: null, difficulty: null }`. Does NOT persist — the
 * caller decides which ideas to keep. No AI provider → `{ needs_ai: true,
 * keywords: [] }`. Never throws.
 */
export const suggestKeywords = async (
  container: MedusaContainer,
  input: SuggestKeywordsInput
): Promise<SuggestKeywordsResult> => {
  const { tenantId, seedTerm } = input
  const count = Math.min(Math.max(Number(input.count) || 10, 1), 30)

  const provider = getAiTextProvider(tenantId)
  if (!provider) {
    return { needs_ai: true, keywords: [] }
  }

  try {
    const hints = await loadCatalogHints(container, tenantId)
    const system = await buildBrandContext(container, tenantId, {})

    const catalogBlock = hints.length
      ? `The store sells products such as: ${hints.join("; ")}.`
      : "The store is a general e-commerce brand."

    const userPrompt =
      `${catalogBlock}\n\n` +
      `Brainstorm ${count} SEO keyword ideas a shopper might search, centered on: ` +
      `"${seedTerm}". Favor realistic, commercially-relevant long-tail phrases ` +
      `that fit this catalog. Do not invent product names not implied above.\n\n` +
      `Return ONLY a JSON object of this exact shape: ` +
      `{ "keywords": [ { "term": string, "intent": ` +
      `"informational" | "commercial" | "transactional" | "navigational" } ] }. ` +
      `Do not wrap the JSON in code fences.`

    const raw = await provider.generate(userPrompt, {
      system,
      json: true,
      temperature: 0.7,
    })
    const parsed = parseJsonLoose(raw)
    const list = Array.isArray(parsed.keywords)
      ? parsed.keywords
      : Array.isArray(parsed.terms)
      ? parsed.terms
      : []

    const seen = new Set<string>()
    const keywords: KeywordSuggestion[] = []
    for (const entry of list) {
      const norm = normalizeKeyword(entry)
      if (!norm) {
        continue
      }
      const key = norm.term.toLowerCase()
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      keywords.push(norm)
      if (keywords.length >= count) {
        break
      }
    }

    if (!keywords.length) {
      // Model returned nothing usable — treat as a needs_ai run.
      return { needs_ai: true, keywords: [] }
    }
    return { keywords }
  } catch {
    // No-throw: an AI failure degrades to needs_ai.
    return { needs_ai: true, keywords: [] }
  }
}

// ---------------------------------------------------------------------------
// Public: generateBrief
// ---------------------------------------------------------------------------

/** The structured outline a brief carries. */
export type BriefOutline = {
  title: string
  meta_description: string
  h2s: string[]
  talking_points: string[]
  internal_link_ideas: string[]
  /** Cached article draft (populated by `generateArticle`). */
  draft_body?: string
  draft_meta?: string
}

/** Input for `generateBrief`. */
export type GenerateBriefInput = {
  tenantId: string
  seoProjectId?: string
  /** The keyword the brief targets. */
  keywordId: string
}

/** Result of `generateBrief`. */
export type GenerateBriefResult = {
  brief: any
  needs_ai?: boolean
}

/** Build a minimal fallback outline from a keyword term (needs_ai path). */
const minimalOutline = (term: string): BriefOutline => ({
  title: term
    ? `${term.charAt(0).toUpperCase()}${term.slice(1)}`
    : "Untitled brief",
  meta_description: "",
  h2s: [],
  talking_points: [],
  internal_link_ideas: [],
})

/** Coerce a parsed outline payload into a clean BriefOutline. */
const normalizeOutline = (
  parsed: Record<string, unknown>,
  fallbackTitle: string
): BriefOutline => {
  const title =
    typeof parsed.title === "string" && parsed.title.trim().length > 0
      ? parsed.title.trim()
      : fallbackTitle
  const meta =
    typeof parsed.meta_description === "string"
      ? parsed.meta_description.trim()
      : ""
  return {
    title,
    meta_description: meta,
    h2s: toStringList(parsed.h2s),
    talking_points: toStringList(parsed.talking_points),
    internal_link_ideas: toStringList(parsed.internal_link_ideas),
  }
}

/**
 * Load a keyword, ask the AI for a structured content outline, and persist a
 * content-brief (outline json, status "ready"). No-throw: when AI is unavailable
 * a minimal outline is stored and `needs_ai: true` returned; the brief is still
 * created so the pipeline can continue by hand.
 */
export const generateBrief = async (
  container: MedusaContainer,
  input: GenerateBriefInput
): Promise<GenerateBriefResult> => {
  const { tenantId, seoProjectId, keywordId } = input
  const mk = resolveMk(container)

  // Load + tenant-check the keyword.
  let keyword: any
  try {
    keyword = await mk.retrieveMarketingKeyword(keywordId)
  } catch {
    keyword = null
  }
  if (!keyword || keyword.tenant_id !== tenantId) {
    // Nothing to write a brief about — surface an empty result, no throw.
    return { brief: null }
  }

  const term = typeof keyword.term === "string" ? keyword.term : ""
  const projectId = seoProjectId ?? keyword.seo_project_id ?? null

  const provider = getAiTextProvider(tenantId)
  let outline = minimalOutline(term)
  let needsAi = false

  if (!provider) {
    needsAi = true
  } else {
    try {
      const hints = await loadCatalogHints(container, tenantId)
      const system = await buildBrandContext(container, tenantId, {})
      const catalogBlock = hints.length
        ? `The store sells products such as: ${hints.join("; ")}.`
        : "The store is a general e-commerce brand."

      const userPrompt =
        `${catalogBlock}\n\n` +
        `Write an SEO content brief for a blog article targeting the keyword: ` +
        `"${term}"${keyword.intent ? ` (search intent: ${keyword.intent})` : ""}.\n\n` +
        `Return ONLY a JSON object of this exact shape: ` +
        `{ "title": string, "meta_description": string, "h2s": string[], ` +
        `"talking_points": string[], "internal_link_ideas": string[] }. ` +
        `"title" is an SEO-optimized H1 including the keyword. ` +
        `"meta_description" is <=160 chars. "h2s" are 4-7 section headings. ` +
        `"talking_points" are concrete points to cover. "internal_link_ideas" ` +
        `are anchor phrases linking to relevant store products/categories. ` +
        `Do not wrap the JSON in code fences.`

      const raw = await provider.generate(userPrompt, {
        system,
        json: true,
        temperature: 0.6,
      })
      const parsed = parseJsonLoose(raw)
      outline = normalizeOutline(parsed, minimalOutline(term).title)
      if (
        !outline.h2s.length &&
        !outline.talking_points.length &&
        !outline.meta_description
      ) {
        needsAi = true
      }
    } catch {
      needsAi = true
      outline = minimalOutline(term)
    }
  }

  const created = await mk.createMarketingContentBriefs({
    tenant_id: tenantId,
    seo_project_id: projectId,
    keyword_id: keywordId,
    outline,
    status: "ready",
  } as any)
  const brief = Array.isArray(created) ? created[0] : created

  // Mark the keyword as targeted now that a brief exists for it (best-effort).
  try {
    if (keyword.status === "tracked") {
      await mk.updateMarketingKeywords({ id: keywordId, status: "targeted" })
    }
  } catch {
    // best-effort lifecycle nudge
  }

  return needsAi ? { brief, needs_ai: true } : { brief }
}

// ---------------------------------------------------------------------------
// Public: generateArticle
// ---------------------------------------------------------------------------

/** Input for `generateArticle`. */
export type GenerateArticleInput = {
  tenantId: string
  /** The brief to write the article from. */
  briefId: string
  brandVoiceId?: string
  /** Products to ground the article in (facts + anti-invention). */
  productIds?: string[]
}

/** Result of `generateArticle`. */
export type GenerateArticleResult = {
  article: any
  body: string
  meta_description: string
  seo_score: number
  needs_ai?: boolean
}

/**
 * Heuristic SEO score (0–100). Rewards keyword presence in the title and
 * headings, a body length in a healthy range, a meta description, and the
 * presence of subheadings. Deliberately simple — a real audit tool can replace
 * this later.
 */
const computeSeoScore = (args: {
  keyword: string
  title: string
  body: string
  metaDescription: string
}): number => {
  const kw = args.keyword.trim().toLowerCase()
  const title = args.title.toLowerCase()
  const body = args.body
  const bodyLower = body.toLowerCase()
  const headingLines = body
    .split("\n")
    .filter((l) => /^#{1,6}\s/.test(l.trim()) || /^\s*#{1,6}/.test(l))
  const words = body.split(/\s+/).filter((w) => w.length > 0).length

  let score = 0

  // Keyword in title (25).
  if (kw && title.includes(kw)) {
    score += 25
  }

  // Keyword appears in the body at least once (15).
  if (kw && bodyLower.includes(kw)) {
    score += 15
  }

  // Keyword in at least one heading (15).
  if (
    kw &&
    headingLines.some((l) => l.toLowerCase().includes(kw))
  ) {
    score += 15
  }

  // Has subheadings at all (15).
  if (headingLines.length >= 2) {
    score += 15
  } else if (headingLines.length === 1) {
    score += 7
  }

  // Body length in a healthy range (20): 600–2500 words is ideal.
  if (words >= 600 && words <= 2500) {
    score += 20
  } else if (words >= 300) {
    score += 12
  } else if (words >= 100) {
    score += 5
  }

  // Meta description present and within a sane length (10).
  const metaLen = args.metaDescription.trim().length
  if (metaLen >= 50 && metaLen <= 160) {
    score += 10
  } else if (metaLen > 0) {
    score += 5
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Generate a full, product-grounded blog article from a brief. Builds the system
 * prompt from `buildBrandContext` (brand voice + product facts + anti-invention)
 * plus SEO writing guidance and the brief outline, then asks for a JSON payload
 * with { title, meta_description, body } (markdown body). Computes a heuristic
 * `seo_score`, persists a `marketing_blog_article` (status "draft"), marks the
 * brief "used", and CACHES the body + meta back onto the brief's outline
 * (`draft_body` / `draft_meta`) so the publish step can retrieve them.
 *
 * No-throw: when AI is unavailable an empty draft article is seeded and
 * `needs_ai: true` returned.
 */
export const generateArticle = async (
  container: MedusaContainer,
  input: GenerateArticleInput
): Promise<GenerateArticleResult> => {
  const { tenantId, briefId, brandVoiceId, productIds = [] } = input
  const mk = resolveMk(container)

  // Load + tenant-check the brief.
  let brief: any
  try {
    brief = await mk.retrieveMarketingContentBrief(briefId)
  } catch {
    brief = null
  }
  if (!brief || brief.tenant_id !== tenantId) {
    return {
      article: null,
      body: "",
      meta_description: "",
      seo_score: 0,
    }
  }

  const outline: BriefOutline = {
    title: "",
    meta_description: "",
    h2s: [],
    talking_points: [],
    internal_link_ideas: [],
    ...((brief.outline ?? {}) as Record<string, unknown>),
  }

  // Resolve the target keyword term for scoring / prompt focus.
  let keywordTerm = ""
  if (brief.keyword_id) {
    try {
      const kw = await mk.retrieveMarketingKeyword(brief.keyword_id)
      if (kw && kw.tenant_id === tenantId && typeof kw.term === "string") {
        keywordTerm = kw.term
      }
    } catch {
      // best-effort
    }
  }

  const provider = getAiTextProvider(tenantId)

  let title =
    typeof outline.title === "string" && outline.title.trim().length > 0
      ? outline.title.trim()
      : keywordTerm || "Untitled article"
  let body = ""
  let metaDescription =
    typeof outline.meta_description === "string"
      ? outline.meta_description.trim()
      : ""
  let needsAi = false

  if (!provider) {
    needsAi = true
  } else {
    try {
      const brandContext = await buildBrandContext(container, tenantId, {
        brandVoiceId,
        productIds,
      })

      const system =
        `${brandContext}\n\n` +
        "You are also an expert SEO blog writer. Write a well-structured, " +
        "genuinely useful long-form article in MARKDOWN. Use a single H1 for the " +
        "title, H2/H3 subheadings, short paragraphs, and lists where helpful. " +
        "Naturally include the target keyword in the title, the intro, and at " +
        "least one subheading without keyword-stuffing. HARD RULE: only state " +
        "facts about products that appear in the grounding facts above; never " +
        "invent products, prices, availability, or specs."

      const outlineBlock =
        `Target keyword: "${keywordTerm}".\n` +
        (outline.title ? `Working title: ${outline.title}\n` : "") +
        (outline.meta_description
          ? `Suggested meta description: ${outline.meta_description}\n`
          : "") +
        (outline.h2s.length
          ? `Section headings to cover:\n- ${outline.h2s.join("\n- ")}\n`
          : "") +
        (outline.talking_points.length
          ? `Talking points:\n- ${outline.talking_points.join("\n- ")}\n`
          : "") +
        (outline.internal_link_ideas.length
          ? `Internal link ideas (weave in as anchor text):\n- ${outline.internal_link_ideas.join(
              "\n- "
            )}\n`
          : "")

      const userPrompt =
        `${outlineBlock}\n` +
        `Write the full article following this brief.\n\n` +
        `Return ONLY a JSON object of this exact shape: ` +
        `{ "title": string, "meta_description": string, "body": string }. ` +
        `"body" is the complete article as markdown (including the H1). ` +
        `"meta_description" is <=160 chars. Do not wrap the JSON in code fences.`

      const raw = await provider.generate(userPrompt, {
        system,
        json: true,
        temperature: 0.7,
      })
      const parsed = parseJsonLoose(raw)

      const parsedTitle =
        typeof parsed.title === "string" ? parsed.title.trim() : ""
      const parsedBody =
        typeof parsed.body === "string" ? parsed.body.trim() : ""
      const parsedMeta =
        typeof parsed.meta_description === "string"
          ? parsed.meta_description.trim()
          : ""

      if (parsedTitle) {
        title = parsedTitle
      }
      if (parsedBody) {
        body = parsedBody
      }
      if (parsedMeta) {
        metaDescription = parsedMeta
      }

      if (!body) {
        needsAi = true
      }
    } catch {
      needsAi = true
      body = ""
    }
  }

  const seoScore = computeSeoScore({
    keyword: keywordTerm,
    title,
    body,
    metaDescription,
  })

  // Persist the article row (no body column — see file header).
  const created = await mk.createMarketingBlogArticles({
    tenant_id: tenantId,
    brief_id: briefId,
    title,
    status: "draft",
    seo_score: seoScore,
  } as any)
  const article = Array.isArray(created) ? created[0] : created

  // Cache the draft body + meta on the brief outline, and mark it "used".
  try {
    await mk.updateMarketingContentBriefs({
      id: briefId,
      status: "used",
      outline: {
        ...outline,
        draft_body: body,
        draft_meta: metaDescription,
      },
    } as any)
  } catch {
    // best-effort: the article row still carries the title + score.
  }

  return needsAi
    ? {
        article,
        body,
        meta_description: metaDescription,
        seo_score: seoScore,
        needs_ai: true,
      }
    : { article, body, meta_description: metaDescription, seo_score: seoScore }
}
