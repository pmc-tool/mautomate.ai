import type { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from "../index"
import { getAiTextProvider } from "../ai/registry"
import { buildBrandContext } from "./brand-context"

/**
 * content-service — the marketing content generation engine.
 *
 * A set of plain functions (not a class) that each take the request `container`
 * and orchestrate: brand grounding (`buildBrandContext`) + an `AiTextProvider`
 * (via the registry) + the module's generated CRUD (posts / targets /
 * revisions). Nothing here is a workflow — these run inline on admin routes.
 *
 * DESIGN RULES:
 *   - NO-THROW on the live path: an AI outage must degrade (empty draft /
 *     unchanged content / `needs_ai`), never crash the request.
 *   - Every content mutation stamps a revision so history is complete and any
 *     prior version can be restored.
 *   - Anti-invention grounding is enforced by `buildBrandContext`, which the AI
 *     provider always receives as the system prompt.
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
 * Best-effort JSON parse of a model response. Handles a bare object, a
 * ```json fenced block, or leading/trailing prose around a `{ ... }` object.
 * Returns `{}` when nothing parseable is found.
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

// ---------------------------------------------------------------------------
// Revision helpers
// ---------------------------------------------------------------------------

/** Compute the next revision version for a post (1-based, monotonic). */
const nextRevisionVersion = async (
  mk: any,
  tenantId: string,
  postId: string
): Promise<number> => {
  try {
    const rows = await mk.listMarketingPostRevisions(
      { tenant_id: tenantId, post_id: postId },
      { order: { version: "DESC" }, take: 1 }
    )
    const latest = rows?.[0]
    const version = typeof latest?.version === "number" ? latest.version : 0
    return version + 1
  } catch {
    return 1
  }
}

/** Build a snapshot json payload from a post row (+ optional targets). */
const buildSnapshot = (
  action: string,
  post: any,
  targets?: any[]
): Record<string, unknown> => ({
  action,
  title: post?.title ?? null,
  body: post?.body ?? null,
  hashtags: post?.hashtags ?? null,
  link_url: post?.link_url ?? null,
  targets: (targets ?? []).map((t) => ({
    id: t?.id ?? null,
    platform: t?.platform ?? null,
    override_body: t?.override_body ?? null,
    override_hashtags: t?.override_hashtags ?? null,
  })),
})

/** Load a post with its current targets, tolerating lookup failures. */
const loadPostWithTargets = async (
  mk: any,
  tenantId: string,
  postId: string
): Promise<{ post: any; targets: any[] }> => {
  const post = await mk.retrieveMarketingPost(postId)
  let targets: any[] = []
  try {
    targets = await mk.listMarketingPostTargets({
      tenant_id: tenantId,
      post_id: postId,
    })
  } catch {
    targets = []
  }
  return { post, targets: targets ?? [] }
}

// ---------------------------------------------------------------------------
// Public: snapshotRevision / restoreRevision
// ---------------------------------------------------------------------------

/** Input for `snapshotRevision`. */
export type SnapshotRevisionInput = {
  tenantId: string
  postId: string
  /** Free-text marker of why the snapshot was taken (e.g. "rework"). */
  action?: string
  /** Optional user id to attribute the revision to. */
  userId?: string
}

/**
 * Capture the current post state as a new immutable revision. No-throw: returns
 * the created revision, or null on any failure.
 */
export const snapshotRevision = async (
  container: MedusaContainer,
  input: SnapshotRevisionInput
): Promise<any | null> => {
  const { tenantId, postId, action = "snapshot", userId } = input
  try {
    const mk = resolveMk(container)
    const { post, targets } = await loadPostWithTargets(mk, tenantId, postId)
    const version = await nextRevisionVersion(mk, tenantId, postId)
    return await mk.createMarketingPostRevisions({
      tenant_id: tenantId,
      post_id: postId,
      version,
      snapshot: buildSnapshot(action, post, targets),
      created_by_user_id: userId ?? null,
    })
  } catch {
    return null
  }
}

/** Input for `restoreRevision`. */
export type RestoreRevisionInput = {
  tenantId: string
  postId: string
  /** The revision version to restore the post's content from. */
  version: number
  userId?: string
}

/**
 * Restore a post's content from a prior revision, then stamp a fresh revision
 * recording the restore. No-throw: returns the updated post, or null on failure.
 */
export const restoreRevision = async (
  container: MedusaContainer,
  input: RestoreRevisionInput
): Promise<any | null> => {
  const { tenantId, postId, version, userId } = input
  try {
    const mk = resolveMk(container)
    const rows = await mk.listMarketingPostRevisions(
      { tenant_id: tenantId, post_id: postId, version },
      { take: 1 }
    )
    const revision = rows?.[0]
    const snapshot = (revision?.snapshot ?? {}) as Record<string, unknown>
    if (!revision) {
      return null
    }

    const updated = await mk.updateMarketingPosts({
      id: postId,
      title: (snapshot.title as string | null) ?? null,
      body: (snapshot.body as string | null) ?? null,
      hashtags: snapshot.hashtags ?? null,
      link_url: (snapshot.link_url as string | null) ?? null,
    })

    await snapshotRevision(container, {
      tenantId,
      postId,
      action: `restore_v${version}`,
      userId,
    })

    return Array.isArray(updated) ? updated[0] : updated
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Public: generatePost
// ---------------------------------------------------------------------------

/** Per-platform copy override produced by the model. */
type PerPlatformCopy = { body?: string; hashtags?: string[] }

/** Input for `generatePost`. */
export type GeneratePostInput = {
  tenantId: string
  /**
   * When set, (re)generate copy INTO this existing post instead of creating a
   * new one: the post body/hashtags are updated in place, each platform target
   * is upserted, and a fresh revision is stamped. When omitted, a new draft
   * post + targets are created.
   */
  postId?: string
  /** The author's brief / instruction for the post. */
  prompt: string
  /** Products to ground the copy in (facts + anti-invention). */
  productIds?: string[]
  /** Target platforms (one target row created per platform). */
  platforms: string[]
  brandVoiceId?: string
  /** Optional tone nudge layered on top of the brand voice. */
  tone?: string
  /** Optional length hint (e.g. "short", "medium", "long"). */
  length?: string
  userId?: string
}

/** Result of `generatePost`. */
export type GeneratePostResult = {
  post: any
  targets: any[]
  /** True when no AI provider was available and an empty draft was seeded. */
  needs_ai?: boolean
}

/** Compose the JSON-shape user prompt for a full post generation. */
const buildGeneratePrompt = (input: GeneratePostInput): string => {
  const platforms = input.platforms.join(", ")
  const lines: string[] = []
  lines.push(input.prompt)
  lines.push("")
  if (input.tone) {
    lines.push(`Desired tone: ${input.tone}.`)
  }
  if (input.length) {
    lines.push(`Desired length: ${input.length}.`)
  }
  lines.push(
    `Write one marketing post and tailor a variation for each of these platforms: ${platforms}.`
  )
  lines.push(
    "Return ONLY a JSON object with this exact shape: " +
      '{ "body": string, "hashtags": string[], "per_platform": { ' +
      '"<platform>": { "body": string, "hashtags": string[] } } }. ' +
      "`body` is the canonical copy. `per_platform` holds one entry per platform " +
      "above whose `body`/`hashtags` are that platform's tailored version (respecting " +
      "its length and style norms). Do not wrap the JSON in code fences."
  )
  return lines.join("\n")
}

/** Normalize a raw per_platform map into typed overrides. */
const normalizePerPlatform = (
  value: unknown
): Record<string, PerPlatformCopy> => {
  const out: Record<string, PerPlatformCopy> = {}
  if (!value || typeof value !== "object") {
    return out
  }
  for (const [platform, raw] of Object.entries(
    value as Record<string, unknown>
  )) {
    if (!raw || typeof raw !== "object") {
      continue
    }
    const entry = raw as Record<string, unknown>
    const body =
      typeof entry.body === "string" && entry.body.trim().length > 0
        ? entry.body
        : undefined
    const hashtags = toStringList(entry.hashtags)
    out[platform] = {
      body,
      hashtags: hashtags.length ? hashtags : undefined,
    }
  }
  return out
}

/**
 * Generate a full multi-platform post: brand-grounded AI copy, persisted as a
 * draft post + one pending target per platform + an initial revision.
 *
 * When no AI provider is configured (or generation fails), an EMPTY draft +
 * targets are seeded and `needs_ai: true` is returned — never throws.
 */
export const generatePost = async (
  container: MedusaContainer,
  input: GeneratePostInput
): Promise<GeneratePostResult> => {
  const {
    tenantId,
    postId,
    prompt,
    productIds = [],
    platforms,
    brandVoiceId,
    userId,
  } = input

  const mk = resolveMk(container)
  const provider = getAiTextProvider()

  let body: string | null = null
  let hashtags: string[] = []
  let perPlatform: Record<string, PerPlatformCopy> = {}
  let needsAi = false

  if (!provider) {
    needsAi = true
  } else {
    try {
      const system = await buildBrandContext(container, tenantId, {
        brandVoiceId,
        productIds,
      })
      const raw = await provider.generate(buildGeneratePrompt(input), {
        system,
        json: true,
        temperature: 0.7,
      })
      const parsed = parseJsonLoose(raw)
      const parsedBody = parsed.body
      body =
        typeof parsedBody === "string" && parsedBody.trim().length > 0
          ? parsedBody
          : null
      hashtags = toStringList(parsed.hashtags)
      perPlatform = normalizePerPlatform(parsed.per_platform)
      if (!body && !hashtags.length && !Object.keys(perPlatform).length) {
        // Model returned nothing usable — treat as a needs_ai draft.
        needsAi = true
      }
    } catch {
      // No-throw: fall back to an empty draft the author can fill in.
      needsAi = true
    }
  }

  let post: any
  const targets: any[] = []

  if (postId) {
    // ---- Update-in-place: (re)generate INTO an existing post. -------------
    // Only overwrite content the model actually produced, so a needs_ai run
    // never wipes an author's existing draft.
    const updated = await mk.updateMarketingPosts({
      id: postId,
      ...(body !== null ? { body } : {}),
      ...(hashtags.length ? { hashtags } : {}),
      ...(productIds.length ? { product_ids: productIds } : {}),
      ...(brandVoiceId ? { brand_voice_id: brandVoiceId } : {}),
    } as any)
    post = Array.isArray(updated) ? updated[0] : updated

    // Upsert one target per platform: update existing, create the rest.
    const existing = await mk.listMarketingPostTargets({
      tenant_id: tenantId,
      post_id: postId,
    })
    const byPlatform = new Map<string, any>(
      (existing ?? []).map((t: any) => [t.platform, t])
    )
    for (const platform of platforms) {
      const override = perPlatform[platform]
      const prior = byPlatform.get(platform)
      if (prior) {
        const res = await mk.updateMarketingPostTargets({
          id: prior.id,
          ...(override?.body !== undefined
            ? { override_body: override.body }
            : {}),
          ...(override?.hashtags !== undefined
            ? { override_hashtags: override.hashtags }
            : {}),
        } as any)
        targets.push(Array.isArray(res) ? res[0] : res)
      } else {
        const res = await mk.createMarketingPostTargets({
          tenant_id: tenantId,
          post_id: postId,
          platform,
          status: "pending",
          override_body: override?.body ?? null,
          override_hashtags: override?.hashtags ?? null,
        } as any)
        targets.push(Array.isArray(res) ? res[0] : res)
      }
    }

    // Stamp the regeneration as the next revision, not version 1.
    try {
      const version = await nextRevisionVersion(mk, tenantId, postId)
      await mk.createMarketingPostRevisions({
        tenant_id: tenantId,
        post_id: postId,
        version,
        snapshot: buildSnapshot(
          needsAi ? "regenerate_empty" : "regenerate",
          post,
          targets
        ),
        created_by_user_id: userId ?? null,
      } as any)
    } catch {
      // Revision is best-effort; the post itself is the source of truth.
    }

    return needsAi ? { post, targets, needs_ai: true } : { post, targets }
  }

  // ---- Create a brand-new draft post + targets. ---------------------------
  const createdPost = await mk.createMarketingPosts({
    tenant_id: tenantId,
    status: "draft",
    body,
    hashtags: hashtags.length ? hashtags : null,
    product_ids: productIds.length ? productIds : null,
    brand_voice_id: brandVoiceId ?? null,
    source: "manual",
    created_by_user_id: userId ?? null,
  } as any)
  post = Array.isArray(createdPost) ? createdPost[0] : createdPost

  for (const platform of platforms) {
    const override = perPlatform[platform]
    const created = await mk.createMarketingPostTargets({
      tenant_id: tenantId,
      post_id: post.id,
      platform,
      status: "pending",
      override_body: override?.body ?? null,
      override_hashtags: override?.hashtags ?? null,
    } as any)
    targets.push(Array.isArray(created) ? created[0] : created)
  }

  // Seed version 1 capturing the freshly generated content.
  try {
    await mk.createMarketingPostRevisions({
      tenant_id: tenantId,
      post_id: post.id,
      version: 1,
      snapshot: buildSnapshot(needsAi ? "generate_empty" : "generate", post, targets),
      created_by_user_id: userId ?? null,
    } as any)
  } catch {
    // Revision is best-effort; the post itself is the source of truth.
  }

  return needsAi ? { post, targets, needs_ai: true } : { post, targets }
}

// ---------------------------------------------------------------------------
// Public: generateText (inline "sparkle" edits)
// ---------------------------------------------------------------------------

/** Supported single-shot inline edit actions. */
export type GenerateTextAction =
  | "shorten"
  | "punch_up"
  | "hashtags"
  | "translate"
  | "custom"

/** Input for `generateText`. */
export type GenerateTextInput = {
  tenantId: string
  /** The text to transform, or the instruction/brief for a "custom" action. */
  prompt: string
  brandVoiceId?: string
  productIds?: string[]
  /** What kind of inline edit to perform. Defaults to "custom". */
  action?: GenerateTextAction
  /** For "translate": the target language (e.g. "es", "French"). */
  targetLanguage?: string
}

/** Map an inline action to an instruction prefix. */
const actionInstruction = (
  action: GenerateTextAction,
  targetLanguage?: string
): string => {
  switch (action) {
    case "shorten":
      return "Shorten the following copy while keeping its meaning and key hook. Return only the rewritten copy:"
    case "punch_up":
      return "Rewrite the following copy to be punchier and more engaging, same length or shorter. Return only the rewritten copy:"
    case "hashtags":
      return "Generate a short, relevant set of hashtags for the following copy. Return only the hashtags, space-separated:"
    case "translate":
      return `Translate the following copy into ${
        targetLanguage ?? "the requested language"
      }, preserving tone. Return only the translation:`
    case "custom":
    default:
      return "Apply the following instruction and return only the resulting copy:"
  }
}

/**
 * Single-shot text transform for inline "sparkle" edits. Returns the model's
 * text, or "" when AI is unavailable or the call fails (no-throw).
 */
export const generateText = async (
  container: MedusaContainer,
  input: GenerateTextInput
): Promise<string> => {
  const { tenantId, prompt, brandVoiceId, productIds, action = "custom" } = input
  const provider = getAiTextProvider()
  if (!provider) {
    return ""
  }
  try {
    const system = await buildBrandContext(container, tenantId, {
      brandVoiceId,
      productIds,
    })
    const userPrompt = `${actionInstruction(
      action,
      input.targetLanguage
    )}\n\n${prompt}`
    const out = await provider.generate(userPrompt, {
      system,
      temperature: 0.6,
    })
    return typeof out === "string" ? out.trim() : ""
  } catch {
    return ""
  }
}

// ---------------------------------------------------------------------------
// Public: reworkPost
// ---------------------------------------------------------------------------

/** Input for `reworkPost`. */
export type ReworkPostInput = {
  tenantId: string
  postId: string
  /** How to rework the post (e.g. "make it funnier and add a CTA"). */
  instruction: string
  userId?: string
}

/**
 * Rework an existing post's canonical body per an instruction: snapshot the
 * current state, regenerate the body, update the post, and stamp a new revision.
 * No-throw: returns the (possibly unchanged) post; on AI failure the body is
 * left as-is.
 */
export const reworkPost = async (
  container: MedusaContainer,
  input: ReworkPostInput
): Promise<{ post: any; changed: boolean; needs_ai?: boolean }> => {
  const { tenantId, postId, instruction, userId } = input
  const mk = resolveMk(container)

  let post: any
  try {
    post = await mk.retrieveMarketingPost(postId)
  } catch {
    return { post: null, changed: false }
  }

  // Preserve the pre-edit state before mutating.
  await snapshotRevision(container, {
    tenantId,
    postId,
    action: "pre_rework",
    userId,
  })

  const provider = getAiTextProvider()
  if (!provider) {
    return { post, changed: false, needs_ai: true }
  }

  const productIds = toStringList(post?.product_ids)
  let newBody: string | null = null
  try {
    const system = await buildBrandContext(container, tenantId, {
      brandVoiceId: post?.brand_voice_id ?? undefined,
      productIds,
    })
    const userPrompt =
      `Rework the marketing post below per this instruction: ${instruction}\n\n` +
      `Current post:\n${post?.body ?? ""}\n\n` +
      "Return only the rewritten post body."
    const out = await provider.generate(userPrompt, {
      system,
      temperature: 0.7,
    })
    newBody = typeof out === "string" && out.trim().length > 0 ? out.trim() : null
  } catch {
    newBody = null
  }

  if (!newBody) {
    return { post, changed: false, needs_ai: !provider ? true : undefined }
  }

  const updated = await mk.updateMarketingPosts({ id: postId, body: newBody })
  const nextPost = Array.isArray(updated) ? updated[0] : updated

  // Stamp the post-edit state.
  await snapshotRevision(container, {
    tenantId,
    postId,
    action: "rework",
    userId,
  })

  return { post: nextPost, changed: true }
}

// ---------------------------------------------------------------------------
// Public: tailorForPlatform
// ---------------------------------------------------------------------------

/** Input for `tailorForPlatform`. */
export type TailorForPlatformInput = {
  tenantId: string
  postId: string
  /** The platform whose target override_body should be (re)written. */
  platform: string
  /** Optional extra steer (e.g. "lean into urgency"). */
  instruction?: string
  userId?: string
}

/**
 * Rewrite one platform target's `override_body` as a platform-native version of
 * the post's canonical copy. Stamps a revision on success. No-throw: returns the
 * (possibly unchanged) target.
 */
export const tailorForPlatform = async (
  container: MedusaContainer,
  input: TailorForPlatformInput
): Promise<{ target: any; changed: boolean; needs_ai?: boolean }> => {
  const { tenantId, postId, platform, instruction, userId } = input
  const mk = resolveMk(container)

  let post: any
  let target: any
  try {
    post = await mk.retrieveMarketingPost(postId)
    const targets = await mk.listMarketingPostTargets(
      { tenant_id: tenantId, post_id: postId, platform },
      { take: 1 }
    )
    target = targets?.[0] ?? null
  } catch {
    return { target: null, changed: false }
  }

  if (!target) {
    return { target: null, changed: false }
  }

  const provider = getAiTextProvider()
  if (!provider) {
    return { target, changed: false, needs_ai: true }
  }

  const productIds = toStringList(post?.product_ids)
  let newBody: string | null = null
  try {
    const system = await buildBrandContext(container, tenantId, {
      brandVoiceId: post?.brand_voice_id ?? undefined,
      productIds,
    })
    const userPrompt =
      `Rewrite the marketing copy below as a ${platform}-native post, respecting ` +
      `${platform}'s length limits, formatting, and tone norms.` +
      (instruction ? ` Additional steer: ${instruction}.` : "") +
      `\n\nCanonical copy:\n${target.override_body ?? post?.body ?? ""}\n\n` +
      "Return only the rewritten copy for this platform."
    const out = await provider.generate(userPrompt, {
      system,
      temperature: 0.7,
    })
    newBody = typeof out === "string" && out.trim().length > 0 ? out.trim() : null
  } catch {
    newBody = null
  }

  if (!newBody) {
    return { target, changed: false }
  }

  const updated = await mk.updateMarketingPostTargets({
    id: target.id,
    override_body: newBody,
  })
  const nextTarget = Array.isArray(updated) ? updated[0] : updated

  await snapshotRevision(container, {
    tenantId,
    postId,
    action: `tailor_${platform}`,
    userId,
  })

  return { target: nextTarget, changed: true }
}
