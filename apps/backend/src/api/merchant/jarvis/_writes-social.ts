import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MedusaRequest } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../modules/marketing"
import {
  getMessagingProvider,
  recordOutboundMessage,
} from "../../../modules/marketing/messaging"
import type { SendResult } from "../../../modules/marketing/messaging"
import { openCredentials } from "../../../modules/marketing/publish/credentials"
import { generatePost } from "../../../modules/marketing/content/content-service"
import { runPublishSweep } from "../../../modules/marketing/publish/runner"
import { withTenant } from "../../../lib/tenant-context"
import { meterAction } from "../../../modules/platform/integration/metering-guard"

/**
 * Pixi P1 — HARD (public / outbound) write tools: SOCIAL POST + CUSTOMER REPLY.
 *
 * These tools speak to the OUTSIDE WORLD on the merchant's behalf — a caption
 * that lands on their Facebook page, a message that lands in a customer's DM.
 * That is irreversible in the way that matters (you cannot un-say a thing that
 * was seen), so both are `tier:"hard"` and carry a `requireText` word the
 * merchant must type. The third tool (hand a thread back to the AI) touches no
 * outsider and is a one-tap `tier:"soft"`.
 *
 * CONTRACT (identical to _writes-money.ts / _writes-soft.ts so a sibling can
 * concat this registry with the others):
 *   - The MODEL only ever supplies human words — a product title, a platform
 *     name, the message text, a "who". It NEVER supplies a post id, a
 *     conversation id, a social-account id, or the tenant. Every id is resolved
 *     server-side here, scoped to `ctx.tenant`.
 *   - `plan()` MUST NOT mutate. It resolves the words into concrete tenant-owned
 *     ids, validates the request (product exists, a social channel is connected,
 *     a customer is actually waiting), and returns a precise `human_summary` for
 *     the confirm card. Any bad state comes back as `{ ok:false, error }` in
 *     plain language — it never throws and never leaks an internal error.
 *   - `apply()` runs ONLY the ids `plan()` froze, by calling the SAME engine the
 *     REST routes use (generate + publish sweep for a post; the messaging
 *     provider for a reply). It re-checks tenant ownership before acting, so a
 *     leaked/forged confirm token still cannot post or reply on another store.
 *
 * HONEST PUBLISHING: live publishing is gated on `MARKETING_ENABLED=1` exactly
 * as the /posts/:id/publish-now route gates it. When publishing is disabled the
 * post is left scheduled-and-due and the result says `state:"queued"` — nothing
 * is ever reported as published when it was not.
 */

export type Ctx = { tenant: any; merchant: any; svc: any }
export type PlanResult =
  | { ok: true; human_summary: string; details: Record<string, unknown>; apply_args: Record<string, any> }
  | { ok: false; error: string }
export type ApplyResult = { result: any; undo?: { action: string; apply_args: Record<string, any> } | { available: false; reason: string } }
export type JarvisWrite = {
  name: string; description: string; parameters: Record<string, unknown>
  risk: "low" | "med" | "high"; tier: "soft" | "hard"; requireText?: string
  plan(req: MedusaRequest, ctx: Ctx, args: Record<string, any>): Promise<PlanResult>
  apply(req: MedusaRequest, ctx: Ctx, applyArgs: Record<string, any>): Promise<ApplyResult>
}

/* --------------------------------- helpers -------------------------------- */

const q = (req: MedusaRequest) => req.scope.resolve(ContainerRegistrationKeys.QUERY)
const mkOf = (req: MedusaRequest): any => req.scope.resolve(MARKETING_MODULE)
const scOf = (ctx: Ctx): string | null => ctx.tenant?.meta?.sales_channel_id ?? null

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? v[0] ?? null : v ?? null

/** conversation.channel -> social account platform (null = no external account). */
const CHANNEL_PLATFORM: Record<string, string | null> = {
  telegram: "telegram",
  messenger: "facebook",
  instagram: "instagram",
  whatsapp: "whatsapp",
  web_widget: null,
}

/** Friendly label for a posting/messaging platform, for the confirm card. */
const PLATFORM_LABEL: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  telegram: "Telegram",
  wordpress: "your blog",
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  web_widget: "the website chat",
}
const labelOf = (p: string): string => PLATFORM_LABEL[p] ?? (p ? p[0].toUpperCase() + p.slice(1) : p)

/** Normalise the loose platform word the model may pass into a real platform key. */
const normalisePlatform = (raw?: string): string | null => {
  const s = String(raw ?? "").toLowerCase().trim()
  if (!s) return null
  if (["facebook", "fb", "meta", "page"].includes(s)) return "facebook"
  if (["instagram", "insta", "ig"].includes(s)) return "instagram"
  if (["linkedin", "li"].includes(s)) return "linkedin"
  if (["x", "twitter", "tweet"].includes(s)) return "x"
  if (["telegram", "tg"].includes(s)) return "telegram"
  if (["wordpress", "blog", "wp"].includes(s)) return "wordpress"
  return s
}

/**
 * Resolve ONE tenant-owned product from a free-text query — the same way P0's
 * search_products and _writes-soft's resolveProduct do: only products linked to
 * this store's sales channel, the provisioned SAMPLE product never matches,
 * exact (case-insensitive) title preferred over a unique substring.
 */
async function resolveProduct(
  req: MedusaRequest,
  ctx: Ctx,
  term: string
): Promise<{ ok: true; product: { id: string; title: string } } | { ok: false; error: string }> {
  const scId = scOf(ctx)
  if (!scId) return { ok: false, error: "Your store isn't fully set up yet." }
  const needle = (term || "").toLowerCase().trim()
  if (!needle) return { ok: false, error: 'Tell me which product to post about, e.g. "Blue Kaftan".' }

  const query = q(req)
  const { data: links } = await query
    .graph({
      entity: "product_sales_channel",
      filters: { sales_channel_id: scId } as any,
      fields: ["product_id"],
      pagination: { take: 2000, skip: 0 } as any,
    })
    .catch(() => ({ data: [] as any[] }))
  const ids = (links || []).map((l: any) => l.product_id).filter(Boolean)
  if (!ids.length) return { ok: false, error: `I couldn't find "${term}" in your store.` }

  const { data: products } = await query
    .graph({
      entity: "product",
      filters: { id: ids } as any,
      fields: ["id", "title", "metadata"],
      pagination: { take: 2000, skip: 0 } as any,
    })
    .catch(() => ({ data: [] as any[] }))

  const rows = (products || []).filter((p: any) => !p.metadata?.is_sample)
  const exact = rows.filter((p: any) => (p.title || "").toLowerCase() === needle)
  const partial = rows.filter((p: any) => (p.title || "").toLowerCase().includes(needle))
  const matches = exact.length ? exact : partial

  if (!matches.length) return { ok: false, error: `I couldn't find "${term}" in your store.` }
  if (matches.length > 1) {
    const names = matches.slice(0, 5).map((p: any) => `"${p.title}"`).join(", ")
    return { ok: false, error: `That matched ${matches.length} products (${names}). Which one did you mean?` }
  }
  return { ok: true, product: { id: matches[0].id, title: matches[0].title } }
}

/** The tenant's connected social accounts (posting side). Tenant-scoped. */
async function connectedAccounts(req: MedusaRequest, ctx: Ctx): Promise<any[]> {
  const mk = mkOf(req)
  const rows = await mk
    .listMarketingSocialAccounts(
      { tenant_id: ctx.tenant.id },
      { take: 200, order: { created_at: "DESC" } }
    )
    .catch(() => [])
  return Array.isArray(rows) ? rows : []
}

/**
 * Tenant backstop for apply(): re-load the conversation scoped to this store and
 * THROW if it isn't ours, so a leaked/forged confirm token can't reply on
 * another tenant's thread. Mirrors _writes-money's assertOwnership.
 */
async function loadOwnConversation(req: MedusaRequest, ctx: Ctx, id: string): Promise<any> {
  const mk = mkOf(req)
  const row = await mk.retrieveMarketingConversation(id).catch(() => null)
  if (!row || row.tenant_id !== ctx.tenant.id) {
    throw new Error("This conversation does not belong to your store.")
  }
  return row
}

/** Best display name for a conversation's customer, for the confirm card. */
async function customerNameFor(req: MedusaRequest, ctx: Ctx, conversation: any): Promise<string> {
  if (!conversation?.contact_id) return "the customer"
  const mk = mkOf(req)
  const contact = await mk.retrieveMarketingContact(conversation.contact_id).catch(() => null)
  return (
    contact?.display_name ||
    contact?.phone ||
    contact?.email ||
    "the customer"
  )
}

/* ========================== 1. create_social_post ========================= */

const createSocialPost: JarvisWrite = {
  name: "create_social_post",
  description:
    "Write and publish a social media post promoting one of the store's products to a connected social account (e.g. Facebook, Instagram) — now, or scheduled for later. Use for 'post about the Blue Kaftan on Facebook', 'promote my new dress on Instagram tomorrow morning'. This publishes PUBLICLY on the merchant's behalf.",
  parameters: {
    type: "object",
    properties: {
      product_query: { type: "string", description: 'Which product to post about, e.g. "Blue Kaftan"' },
      platform: { type: "string", description: "Optional social platform, e.g. 'facebook' or 'instagram'. Defaults to a connected account." },
      message: { type: "string", description: "Optional caption or angle for the post. If omitted, the AI writes it from the product." },
      schedule_at: { type: "string", description: "Optional ISO datetime to schedule the post; omit to post now." },
    },
    required: ["product_query"],
    additionalProperties: false,
  },
  risk: "high",
  tier: "hard",
  requireText: "POST",

  async plan(req, ctx, args) {
    const pr = await resolveProduct(req, ctx, args.product_query)
    if (!pr.ok) return { ok: false, error: pr.error }
    const { product } = pr

    const accounts = await connectedAccounts(req, ctx)
    if (!accounts.length) {
      return { ok: false, error: "Connect a Facebook/Instagram account in Marketing → Channels first." }
    }

    // Resolve the target platform + the connected account that backs it.
    const requested = normalisePlatform(args.platform)
    let account: any
    if (requested) {
      account = accounts.find((a: any) => a.platform === requested) ?? null
      if (!account) {
        const have = Array.from(new Set(accounts.map((a: any) => labelOf(a.platform)))).join(", ")
        return {
          ok: false,
          error: `You don't have a ${labelOf(requested)} account connected. Connected: ${have}. Connect one in Marketing → Channels first.`,
        }
      }
    } else {
      // No platform named: prefer Facebook, then Instagram, else the newest account.
      account =
        accounts.find((a: any) => a.platform === "facebook") ??
        accounts.find((a: any) => a.platform === "instagram") ??
        accounts[0]
    }
    const platform = account.platform

    // Validate the schedule if one was given (read-only).
    let scheduleAt: string | null = null
    if (args.schedule_at != null && String(args.schedule_at).trim()) {
      const when = new Date(String(args.schedule_at))
      if (isNaN(when.getTime())) {
        return { ok: false, error: "That schedule time didn't look like a valid date/time." }
      }
      scheduleAt = when.toISOString()
    }

    const message = typeof args.message === "string" && args.message.trim() ? args.message.trim() : null
    const when = scheduleAt
      ? `on ${new Date(scheduleAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
      : "now"

    return {
      ok: true,
      human_summary: `Post about "${product.title}" to ${labelOf(platform)} ${when}?`,
      details: {
        product: product.title,
        platform: labelOf(platform),
        when: scheduleAt ? "scheduled" : "now",
        schedule_at: scheduleAt,
        has_caption: !!message,
      },
      apply_args: {
        product_id: product.id,
        product_title: product.title,
        platform,
        social_account_id: account.id,
        prompt: message ?? `Write a short, engaging social media post promoting our product "${product.title}".`,
        message,
        schedule_at: scheduleAt,
      },
    }
  },

  async apply(req, ctx, applyArgs) {
    const tenantId = ctx.tenant.id
    const svc = mkOf(req)

    // Re-check the product still belongs to this store before publishing.
    const pr = await resolveProduct(req, ctx, applyArgs.product_title || "")
    if (!pr.ok || pr.product.id !== applyArgs.product_id) {
      throw new Error("That product is no longer available in your store.")
    }

    // 1. Create the draft shell + the single platform target (carrying the
    //    connected account so the publish sweep can actually deliver it).
    const createdPost = await svc.createMarketingPosts({
      tenant_id: tenantId,
      status: "draft",
      source: "manual",
      title: applyArgs.product_title ? String(applyArgs.product_title).slice(0, 200) : null,
      product_ids: [applyArgs.product_id],
      created_by_user_id: ctx.merchant?.id ?? null,
    } as any)
    const post = Array.isArray(createdPost) ? createdPost[0] : createdPost
    const postId = post.id

    await svc.createMarketingPostTargets([
      {
        tenant_id: tenantId,
        post_id: postId,
        platform: applyArgs.platform,
        social_account_id: applyArgs.social_account_id ?? null,
        status: "pending",
      },
    ] as any)

    // 2. Generate the copy, metered on the tenant's AI credits — the SAME action
    //    key ("ai_text", 1 unit) the /posts/generate route uses.
    const metered = await meterAction(req.scope, tenantId, "ai_text", 1, async () => {
      const r = await generatePost(req.scope, {
        postId,
        tenantId,
        prompt: applyArgs.prompt,
        productIds: [applyArgs.product_id],
        platforms: [applyArgs.platform],
      } as any)
      return { result: r, actualUnits: (r as any)?.needs_ai ? 0 : 1 }
    })
    if (!metered.ok) {
      throw new Error("You're out of AI credits — top up in Billing to publish a post.")
    }

    const now = new Date()
    const scheduleAt = applyArgs.schedule_at ? new Date(applyArgs.schedule_at) : null

    // 3a. SCHEDULE path — mirror /posts/:id/schedule exactly.
    if (scheduleAt) {
      const targets = await svc.listMarketingPostTargets({ tenant_id: tenantId, post_id: postId })
      await svc.updateMarketingPostTargets(
        (Array.isArray(targets) ? targets : []).map((t: any) => ({
          id: t.id,
          status: "scheduled",
          scheduled_at: scheduleAt,
        })) as any
      )
      await svc.updateMarketingPosts({ id: postId, status: "scheduled" } as any)
      return {
        result: { post_id: postId, state: "scheduled", scheduled_at: scheduleAt.toISOString() },
        undo: { available: false, reason: "delete or unschedule the post from Marketing → Posts" },
      }
    }

    // 3b. PUBLISH-NOW path — make targets due now, then respect MARKETING_ENABLED
    //     EXACTLY as the publish-now route does.
    const targets = await svc.listMarketingPostTargets({ tenant_id: tenantId, post_id: postId })
    await svc.updateMarketingPostTargets(
      (Array.isArray(targets) ? targets : []).map((t: any) => ({
        id: t.id,
        status: "scheduled",
        scheduled_at: now,
      })) as any
    )

    const publishingEnabled = process.env.MARKETING_ENABLED === "1"
    if (!publishingEnabled) {
      // HONEST: nothing is faked as published — the post is queued and due.
      await svc.updateMarketingPosts({ id: postId, status: "scheduled" } as any)
      return {
        result: {
          post_id: postId,
          state: "queued",
          note: "Live publishing is currently off, so the post is saved and queued — it will go out once publishing is enabled and the account is connected.",
        },
        undo: { available: false, reason: "delete or unschedule the post from Marketing → Posts" },
      }
    }

    // Enabled: run the tenant's publish sweep so the engine claims + delivers.
    const sweep = await withTenant(tenantId, () => runPublishSweep(req.scope, { now }))
    const published = (sweep?.published ?? 0) > 0
    return {
      result: { post_id: postId, state: published ? "published" : "queued" },
      undo: { available: false, reason: "delete or unschedule the post from Marketing → Posts" },
    }
  },
}

/* ========================== 2. reply_to_customer ========================== */

/**
 * Find the ONE conversation Pixi should reply to, tenant-scoped. Preference:
 * an explicit `conversation_ref` (id), else a match on `to` (contact) / channel,
 * else the OLDEST open thread that is waiting for a human (handler_mode
 * "queued"). Read-only.
 */
async function findReplyTarget(
  req: MedusaRequest,
  ctx: Ctx,
  args: Record<string, any>
): Promise<{ ok: true; conversation: any } | { ok: false; error: string }> {
  const mk = mkOf(req)
  const tenantId = ctx.tenant.id
  const channel = normaliseChannel(args.channel)

  // 1. Explicit conversation id.
  if (args.conversation_ref && String(args.conversation_ref).startsWith("conv")) {
    const row = await mk.retrieveMarketingConversation(String(args.conversation_ref)).catch(() => null)
    if (!row || row.tenant_id !== tenantId) return { ok: false, error: "I couldn't find that conversation in your inbox." }
    return { ok: true, conversation: row }
  }

  // 2. Pull the open, human-waiting threads (oldest activity first).
  const filter: Record<string, any> = { tenant_id: tenantId, handler_mode: "queued", status: { $ne: "closed" } }
  if (channel) filter.channel = channel
  const queued = await mk
    .listMarketingConversations(filter, { order: { last_message_at: "ASC" }, take: 100 })
    .catch(() => [])
  let rows: any[] = Array.isArray(queued) ? queued : []

  // 3. Narrow by "to" (contact name / phone / email) or a free-text ref.
  const needle = String(args.to ?? args.conversation_ref ?? "").toLowerCase().trim()
  if (needle && rows.length) {
    const contactIds = Array.from(new Set(rows.map((r) => r.contact_id).filter(Boolean))) as string[]
    const contacts = contactIds.length
      ? await mk.listMarketingContacts({ tenant_id: tenantId, id: contactIds }).catch(() => [])
      : []
    const byId = new Map((Array.isArray(contacts) ? contacts : []).map((c: any) => [c.id, c]))
    const matches = (v: any) => typeof v === "string" && v.toLowerCase().includes(needle)
    const narrowed = rows.filter((r) => {
      const c = r.contact_id ? byId.get(r.contact_id) : null
      return c && (matches(c.display_name) || matches(c.phone) || matches(c.email))
    })
    if (narrowed.length) rows = narrowed
  }

  if (!rows.length) {
    return { ok: false, error: "No customer is waiting for a reply right now." }
  }
  return { ok: true, conversation: rows[0] }
}

const normaliseChannel = (raw?: string): string | null => {
  const s = String(raw ?? "").toLowerCase().trim()
  if (!s) return null
  if (["whatsapp", "wa"].includes(s)) return "whatsapp"
  if (["messenger", "facebook", "fb"].includes(s)) return "messenger"
  if (["instagram", "insta", "ig", "dm"].includes(s)) return "instagram"
  if (["telegram", "tg"].includes(s)) return "telegram"
  if (["web", "web_widget", "website", "chat"].includes(s)) return "web_widget"
  return s
}

const channelLabel = (channel: string): string => {
  const map: Record<string, string> = {
    whatsapp: "WhatsApp",
    messenger: "Messenger",
    instagram: "Instagram",
    telegram: "Telegram",
    web_widget: "the website chat",
  }
  return map[channel] ?? channel
}

const replyToCustomer: JarvisWrite = {
  name: "reply_to_customer",
  description:
    "Send a reply to a customer who is waiting for a human in the store's inbox — on whatever channel they messaged from (WhatsApp, Messenger, Instagram, Telegram, website chat). Use for 'reply to Sarah that we ship to Dhaka in 2 days', 'tell the customer waiting that it's back in stock'. This sends a REAL message to a REAL person.",
  parameters: {
    type: "object",
    properties: {
      message: { type: "string", description: "The reply to send, in plain language." },
      channel: { type: "string", description: "Optional channel to disambiguate, e.g. 'whatsapp'." },
      to: { type: "string", description: "Optional customer name/handle to disambiguate who to reply to." },
      conversation_ref: { type: "string", description: "Optional conversation id or a name to target a specific thread." },
    },
    required: ["message"],
    additionalProperties: false,
  },
  risk: "high",
  tier: "hard",
  requireText: "SEND",

  async plan(req, ctx, args) {
    const message = typeof args.message === "string" ? args.message.trim() : ""
    if (!message) return { ok: false, error: "Tell me what you'd like to say to the customer." }

    const t = await findReplyTarget(req, ctx, args)
    if (!t.ok) return { ok: false, error: t.error }
    const { conversation } = t

    const who = await customerNameFor(req, ctx, conversation)
    const channel = conversation.channel as string
    const preview = message.length > 140 ? `${message.slice(0, 137)}...` : message

    return {
      ok: true,
      human_summary: `Reply to ${who} on ${channelLabel(channel)}: "${preview}"?`,
      details: { to: who, channel: channelLabel(channel), message },
      apply_args: { conversation_id: conversation.id, message },
    }
  },

  async apply(req, ctx, applyArgs) {
    const tenantId = ctx.tenant.id
    // Tenant backstop: re-load scoped to this store, throw if not ours.
    const conversation = await loadOwnConversation(req, ctx, applyArgs.conversation_id)
    const mk = mkOf(req)

    const text = String(applyArgs.message ?? "")
    const channel = conversation.channel as string

    // Resolve the outbound credentials the same way /conversations/:id/reply does.
    let credentials: { accessToken: string | null; meta: Record<string, any> | null } = {
      accessToken: null,
      meta: null,
    }
    let skipSend = false
    const hasMapping = Object.prototype.hasOwnProperty.call(CHANNEL_PLATFORM, channel)
    const platform = hasMapping ? CHANNEL_PLATFORM[channel] : undefined

    if (!hasMapping) {
      skipSend = true
    } else if (platform === null) {
      // web_widget: no external account; the provider stores the reply itself.
    } else {
      const account = first(
        await mk.listMarketingSocialAccounts({ tenant_id: tenantId, platform })
      )
      if (!account) {
        skipSend = true
      } else {
        const creds = await openCredentials(mk, tenantId, account.id)
        if (!creds || !creds.accessToken) skipSend = true
        else credentials = { accessToken: creds.accessToken, meta: creds.meta }
      }
    }

    // The send + the message record must stamp THIS tenant. recordOutboundMessage
    // reads the tenant from the async context, so wrap the whole thing.
    const outcome = await withTenant(tenantId, async () => {
      let result: SendResult
      if (skipSend) {
        result = { ok: false, deliveryStatus: "no_channel_credential" }
      } else {
        const provider = getMessagingProvider(channel)
        if (!provider) {
          result = { ok: false, deliveryStatus: "no_channel_credential" }
        } else {
          try {
            result = await provider.sendMessage({
              channel: channel as any,
              externalThreadId: conversation.external_thread_id ?? "",
              credentials,
              text,
              media: [],
            })
          } catch (e: any) {
            result = { ok: false, deliveryStatus: "failed", error: { message: e?.message ?? "send failed", retryable: false } }
          }
        }
      }

      const deliveryStatus = result.ok
        ? result.deliveryStatus ?? "sent"
        : result.deliveryStatus ?? "failed"

      // The reply is ALWAYS recorded to the thread so it's visible even when the
      // external send failed; only `delivered` reflects the outside outcome.
      await recordOutboundMessage(req.scope, {
        conversationId: conversation.id,
        body: text,
        author: "agent",
        externalMessageId: result.externalMessageId ?? null,
        deliveryStatus,
      })

      if (!result.ok && platform) {
        const reason =
          result.error?.message ??
          (deliveryStatus === "no_channel_credential" ? "no connected account for this channel" : "unknown error")
        await recordOutboundMessage(req.scope, {
          conversationId: conversation.id,
          body: `Delivery to ${channel} failed: ${reason}`,
          author: "system",
          deliveryStatus: "internal",
        }).catch(() => null)
      }

      return result
    })

    return {
      result: { sent: outcome.ok, channel: channelLabel(channel) },
      undo: { available: false, reason: "a sent message can't be unsent" },
    }
  },
}

/* ======================= 3. hand_conversation_to_ai ======================= */

const handConversationToAi: JarvisWrite = {
  name: "hand_conversation_to_ai",
  description:
    "Hand a customer conversation that's currently waiting for a human back to the AI assistant, so the AI answers it again. Use for 'let the AI take this one', 'give the chat with Sarah back to the assistant'.",
  parameters: {
    type: "object",
    properties: {
      conversation_ref: { type: "string", description: "Optional conversation id or customer name to target a specific thread." },
    },
    required: [],
    additionalProperties: false,
  },
  risk: "low",
  tier: "soft",

  async plan(req, ctx, args) {
    const mk = mkOf(req)
    const tenantId = ctx.tenant.id

    let conversation: any = null
    if (args.conversation_ref && String(args.conversation_ref).startsWith("conv")) {
      const row = await mk.retrieveMarketingConversation(String(args.conversation_ref)).catch(() => null)
      if (!row || row.tenant_id !== tenantId) {
        return { ok: false, error: "I couldn't find that conversation in your inbox." }
      }
      conversation = row
    } else {
      // The oldest thread a human is holding (queued or human), narrowed by name.
      const rows = await mk
        .listMarketingConversations(
          { tenant_id: tenantId, handler_mode: { $in: ["queued", "human"] }, status: { $ne: "closed" } },
          { order: { last_message_at: "ASC" }, take: 100 }
        )
        .catch(() => [])
      let list: any[] = Array.isArray(rows) ? rows : []
      const needle = String(args.conversation_ref ?? "").toLowerCase().trim()
      if (needle && list.length) {
        const contactIds = Array.from(new Set(list.map((r) => r.contact_id).filter(Boolean))) as string[]
        const contacts = contactIds.length
          ? await mk.listMarketingContacts({ tenant_id: tenantId, id: contactIds }).catch(() => [])
          : []
        const byId = new Map((Array.isArray(contacts) ? contacts : []).map((c: any) => [c.id, c]))
        const matches = (v: any) => typeof v === "string" && v.toLowerCase().includes(needle)
        const narrowed = list.filter((r) => {
          const c = r.contact_id ? byId.get(r.contact_id) : null
          return c && (matches(c.display_name) || matches(c.phone) || matches(c.email))
        })
        if (narrowed.length) list = narrowed
      }
      if (!list.length) {
        return { ok: false, error: "No conversation is currently held by a human to hand back." }
      }
      conversation = list[0]
    }

    if (conversation.handler_mode === "ai") {
      return { ok: false, error: "That conversation is already handled by the AI assistant." }
    }

    const who = await customerNameFor(req, ctx, conversation)
    return {
      ok: true,
      human_summary: `Hand the conversation with ${who} on ${channelLabel(conversation.channel)} back to the AI assistant?`,
      details: { to: who, channel: channelLabel(conversation.channel) },
      apply_args: { conversation_id: conversation.id },
    }
  },

  async apply(req, ctx, applyArgs) {
    const tenantId = ctx.tenant.id
    const conversation = await loadOwnConversation(req, ctx, applyArgs.conversation_id)
    const mk = mkOf(req)
    const priorMode = conversation.handler_mode

    // A human-assigned thread may only be released by its assigned agent (parity
    // with /conversations/:id/return-to-ai). Queued/unassigned = anyone.
    if (conversation.assigned_user_id && conversation.assigned_user_id !== ctx.merchant?.id) {
      throw new Error("That conversation is assigned to another agent, so only they can return it to the AI.")
    }

    await mk.updateMarketingConversations({
      id: conversation.id,
      handler_mode: "ai",
      assigned_user_id: null,
      handoff_reason: null,
    } as any)

    await withTenant(tenantId, () =>
      recordOutboundMessage(req.scope, {
        conversationId: conversation.id,
        body: "Conversation returned to the AI assistant.",
        author: "system",
        deliveryStatus: "internal",
      })
    ).catch(() => null)

    return {
      result: { conversation_id: conversation.id, handler_mode: "ai" },
      // Undo = take it back to where a human holds it (queued). Dispatched through
      // the confirm gate only if a `queue_conversation` executor is registered.
      undo: { action: "queue_conversation", apply_args: { conversation_id: conversation.id, prior_mode: priorMode } },
    }
  },
}

/**
 * Hidden executor for the Undo of `hand_conversation_to_ai` — puts a thread back
 * into the human queue. Not exposed to the model (kept out of SOCIAL_WRITES);
 * wire it into the shared HIDDEN_WRITES registry the same way _writes-soft's
 * `cancelFulfillment` and _writes-extra's `deleteProduct` are wired.
 */
export const queueConversation: JarvisWrite = {
  name: "queue_conversation",
  description: "internal — undo a hand-back to AI (dispatched only as an Undo)",
  parameters: { type: "object", properties: {}, additionalProperties: true },
  risk: "low",
  tier: "soft",
  plan: async () => ({ ok: false, error: "not directly callable" }),
  async apply(req, ctx, applyArgs) {
    const conversation = await loadOwnConversation(req, ctx, applyArgs.conversation_id)
    const mk = mkOf(req)
    await mk.updateMarketingConversations({
      id: conversation.id,
      handler_mode: "queued",
    } as any)
    return {
      result: { conversation_id: conversation.id, handler_mode: "queued" },
      undo: { available: false, reason: "hand it back to the AI from the inbox if you like" },
    }
  },
}

/* ------------------------------- registry -------------------------------- */

export const SOCIAL_WRITES: JarvisWrite[] = [
  createSocialPost,
  replyToCustomer,
  handConversationToAi,
]
