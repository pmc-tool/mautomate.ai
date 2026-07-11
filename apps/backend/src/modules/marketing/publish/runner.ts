import {
  getCurrentTenantId,
  resolveTenantId,
} from "../../../lib/tenant-context"
/**
 * publish/runner — the claim-first publish engine.
 *
 * `runPublishSweep` finds DUE post targets (scheduled and due, or failed and
 * ready for retry), claims each one by flipping it to "publishing" BEFORE doing
 * any work, resolves the provider + decrypted account credentials, calls the
 * platform adapter, and records the outcome with bounded exponential backoff.
 * After a post's targets are processed it reconciles the parent post's rollup
 * status (published / partially_published / failed).
 *
 * CONCURRENCY MODEL (claim-first, Redis-independent):
 *   Medusa's data layer has no conditional/compare-and-swap update, so we cannot
 *   atomically "claim if still scheduled". Instead we CLAIM-THEN-WORK: the first
 *   thing we do per target is `update(status:"publishing")`. A second concurrent
 *   worker re-reading due targets a moment later will no longer see it as due
 *   (its status is no longer "scheduled"/"failed"), so it is skipped. There is a
 *   tiny window where two workers read the same "scheduled" row before either
 *   claims it; this is acceptable for this workload and documented here as the
 *   known limitation. For hard exactly-once, back the claim with a Redis lock.
 *
 * Everything is tenant-scoped and defensive: a single malformed target is caught
 * and marked failed without aborting the rest of the sweep.
 */

import type { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from "../index"
import { SettingsService } from "../settings/settings-service"
import {
  getPublishProvider,
  openCredentials,
  type PublishInput,
  type ProviderMedia,
} from "./index"

const currentTenantId = (): string =>
  getCurrentTenantId() ?? resolveTenantId("MARKETING_DEFAULT_TENANT")

/** Default number of due targets processed per sweep. */
const DEFAULT_LIMIT = 25

/** Backoff ceiling in minutes — attempt N waits min(2^N, 60) minutes. */
const MAX_BACKOFF_MINUTES = 60

export type PublishSweepResult = {
  claimed: number
  published: number
  failed: number
  skipped: number
}

/** Compute the next retry time: now + min(2^attempts, 60) minutes. */
const backoffFrom = (now: Date, attempts: number): Date => {
  const minutes = Math.min(Math.pow(2, attempts), MAX_BACKOFF_MINUTES)
  return new Date(now.getTime() + minutes * 60 * 1000)
}

/** Map post media rows to the adapter's `ProviderMedia`, ordered by position. */
const toProviderMedia = (media: any[]): ProviderMedia[] =>
  [...(media ?? [])]
    .sort((a, b) => Number(a?.position ?? 0) - Number(b?.position ?? 0))
    .map((m) => ({
      url: m?.url ?? null,
      kind: m?.kind === "video" ? "video" : "image",
      alt: m?.alt ?? null,
    }))
    .filter((m): m is ProviderMedia => Boolean(m.url))

/**
 * Reconcile a parent post's rollup status from its targets. Exported for reuse
 * by routes/workflows that mutate targets outside the sweep.
 *
 *   all published                 -> "published"
 *   some published, some failed    -> "partially_published"
 *   all failed                     -> "failed"
 *   otherwise (still in-flight)     -> left untouched
 */
export const reconcilePostStatus = async (
  mk: any,
  tenantId: string,
  postId: string
): Promise<void> => {
  if (!postId) {
    return
  }

  let targets: any[] = []
  try {
    targets = await mk.listMarketingPostTargets({
      tenant_id: tenantId,
      post_id: postId,
    })
  } catch {
    return
  }

  if (!targets?.length) {
    return
  }

  const statuses = targets.map((t) => t?.status)
  const allPublished = statuses.every((s) => s === "published")
  const anyPublished = statuses.some((s) => s === "published")
  const allFailed = statuses.every((s) => s === "failed")

  let next: string | null = null
  if (allPublished) {
    next = "published"
  } else if (allFailed) {
    next = "failed"
  } else if (anyPublished && statuses.some((s) => s === "failed")) {
    next = "partially_published"
  }

  if (!next) {
    return
  }

  try {
    await mk.updateMarketingPosts({ id: postId, status: next } as any)
  } catch {
    // Non-fatal: the next sweep reconciles again.
  }
}

/** Mark a target failed. `retryable` controls whether it can be picked up again. */
const failTarget = async (
  mk: any,
  target: any,
  now: Date,
  opts: {
    message: string
    code?: string
    retryable: boolean
    /** When true, exhaust attempts so a retryable-looking failure never retries. */
    exhaust?: boolean
  }
): Promise<void> => {
  const attempts = Number(target?.attempts ?? 0) + 1
  const maxAttempts = Number(target?.max_attempts ?? 3)

  const canRetry =
    opts.retryable && !opts.exhaust && attempts < maxAttempts

  const patch: Record<string, unknown> = {
    id: target.id,
    status: "failed",
    attempts: opts.exhaust ? maxAttempts : attempts,
    error: opts.message,
    next_retry_at: canRetry ? backoffFrom(now, attempts) : null,
  }

  await mk.updateMarketingPostTargets(patch as any)
}

/** Set a connected account's health status (e.g. "expired" on dead token). */
const setAccountStatus = async (
  mk: any,
  accountId: string | null | undefined,
  status: string
): Promise<void> => {
  if (!accountId) {
    return
  }
  try {
    await mk.updateMarketingSocialAccounts({ id: accountId, status } as any)
  } catch {
    // Non-fatal.
  }
}

/**
 * Process a single already-claimed target end to end. Returns "published" or
 * "failed" for the caller's counters. Never throws — a thrown error becomes a
 * non-retryable failure for THIS target only.
 */
const processTarget = async (
  mk: any,
  target: any,
  now: Date
): Promise<"published" | "failed"> => {
  // 4. Resolve the provider adapter.
  const provider = getPublishProvider(target.platform)
  if (!provider || !provider.isConfigured()) {
    await failTarget(mk, target, now, {
      message: "no provider",
      code: "no_provider",
      retryable: false,
      exhaust: true,
    })
    return "failed"
  }

  // 5. Resolve the connected account.
  const socialAccountId = target.social_account_id
  if (!socialAccountId) {
    await failTarget(mk, target, now, {
      message: "no connected account",
      code: "no_account",
      retryable: false,
      exhaust: true,
    })
    return "failed"
  }

  // 6. Open (decrypt) credentials. Missing/empty token => account needs reconnect.
  const credentials = await openCredentials(mk, currentTenantId(), socialAccountId)
  if (!credentials || !credentials.accessToken) {
    await setAccountStatus(mk, socialAccountId, "expired")
    await failTarget(mk, target, now, {
      message: "missing or expired account credentials",
      code: "auth",
      retryable: false,
      exhaust: true,
    })
    return "failed"
  }

  // 7. Load the post + media and build the self-contained PublishInput.
  const post = await mk.retrieveMarketingPost(target.post_id, {
    relations: ["media"],
  })

  let account: any = null
  try {
    account = await mk.retrieveMarketingSocialAccount(socialAccountId)
  } catch {
    account = null
  }

  const input: PublishInput = {
    tenantId: currentTenantId(),
    account: {
      id: socialAccountId,
      external_id: account?.external_id ?? null,
      handle: account?.handle ?? null,
      meta: (account?.meta as Record<string, any>) ?? null,
    },
    credentials,
    content: {
      body: target.override_body ?? post?.body ?? null,
      hashtags: (target.override_hashtags ?? post?.hashtags ?? null) as
        | string[]
        | null,
      link: post?.link_url ?? null,
      title: post?.title ?? null,
    },
    media: toProviderMedia(post?.media),
  }

  // 8. Publish.
  const result = await provider.publish(input)

  if (result.ok) {
    await mk.updateMarketingPostTargets({
      id: target.id,
      status: "published",
      published_at: now,
      external_post_id: result.externalId ?? null,
      external_url: result.url ?? null,
      error: null,
      next_retry_at: null,
    } as any)
    return "published"
  }

  // ok:false — apply retry/backoff policy.
  const err = result.error ?? { message: "publish failed", retryable: false }
  const attempts = Number(target?.attempts ?? 0) + 1
  const maxAttempts = Number(target?.max_attempts ?? 3)
  const canRetry = Boolean(err.retryable) && attempts < maxAttempts

  if (err.code === "auth") {
    await setAccountStatus(mk, socialAccountId, "expired")
  }

  await mk.updateMarketingPostTargets({
    id: target.id,
    status: "failed",
    attempts,
    error: err.message,
    next_retry_at: canRetry ? backoffFrom(now, attempts) : null,
  } as any)

  return "failed"
}

/**
 * Run one publish sweep. Safe to call concurrently (claim-first) and from either
 * the scheduled job or an on-demand trigger.
 */
export const runPublishSweep = async (
  container: MedusaContainer,
  opts?: { limit?: number; now?: Date }
): Promise<PublishSweepResult> => {
  const zero: PublishSweepResult = {
    claimed: 0,
    published: 0,
    failed: 0,
    skipped: 0,
  }

  const mk: any = container.resolve(MARKETING_MODULE)
  const settings = new SettingsService(container)

  // 1. Master gate — two independent kill switches.
  if (process.env.MARKETING_ENABLED !== "1") {
    return zero
  }
  try {
    if (await settings.isPublishingHalted(currentTenantId())) {
      return zero
    }
  } catch {
    // Fail-safe: settings lookup failed -> treat as NOT halted (isPublishingHalted
    // already swallows errors, but guard here too) and continue.
  }

  const now = opts?.now ?? new Date()
  const limit = opts?.limit ?? DEFAULT_LIMIT

  // 2. Find DUE targets: scheduled+due, or failed+retry-ready (attempts left).
  //    Two queries (attempts < max_attempts is a column-vs-column compare that
  //    the filter DSL can't express, so we filter that in JS).
  let dueScheduled: any[] = []
  let dueFailed: any[] = []
  try {
    dueScheduled = await mk.listMarketingPostTargets(
      {
        tenant_id: currentTenantId(),
        status: "scheduled",
        scheduled_at: { $lte: now },
      },
      { take: limit, order: { scheduled_at: "ASC" } }
    )
  } catch {
    dueScheduled = []
  }
  try {
    dueFailed = await mk.listMarketingPostTargets(
      {
        tenant_id: currentTenantId(),
        status: "failed",
        next_retry_at: { $lte: now },
      },
      { take: limit, order: { scheduled_at: "ASC" } }
    )
  } catch {
    dueFailed = []
  }

  const retryable = (dueFailed ?? []).filter(
    (t) => Number(t?.attempts ?? 0) < Number(t?.max_attempts ?? 3)
  )

  const due = [...(dueScheduled ?? []), ...retryable]
    .sort((a, b) => {
      const at = a?.scheduled_at ? new Date(a.scheduled_at).getTime() : 0
      const bt = b?.scheduled_at ? new Date(b.scheduled_at).getTime() : 0
      return at - bt
    })
    .slice(0, limit)

  const result: PublishSweepResult = { ...zero }
  const affectedPostIds = new Set<string>()

  for (const target of due) {
    // 3. CLAIM the target first (claim-then-work — see file header note).
    try {
      await mk.updateMarketingPostTargets({
        id: target.id,
        status: "publishing",
      } as any)
      result.claimed += 1
    } catch {
      // Lost the claim (e.g. another worker/deleted) — skip it.
      result.skipped += 1
      continue
    }

    if (target.post_id) {
      affectedPostIds.add(target.post_id)
    }

    // 9. Work the target; a throw is a non-retryable failure for THIS target only.
    try {
      const outcome = await processTarget(mk, target, now)
      if (outcome === "published") {
        result.published += 1
      } else {
        result.failed += 1
      }
    } catch (e: any) {
      result.failed += 1
      try {
        await failTarget(mk, target, now, {
          message: e?.message ? String(e.message) : "unexpected error",
          code: "unexpected",
          retryable: false,
          exhaust: true,
        })
      } catch {
        // Best-effort: leave it "publishing"; the reconcile sweep can heal it.
      }
    }
  }

  // 10. Reconcile each affected post's rollup status (deduped post ids).
  for (const postId of affectedPostIds) {
    await reconcilePostStatus(mk, currentTenantId(), postId)
  }

  return result
}

export default runPublishSweep
