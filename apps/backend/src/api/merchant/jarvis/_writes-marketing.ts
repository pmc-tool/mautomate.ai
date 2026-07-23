import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MedusaRequest } from "@medusajs/framework/http"
import type { JarvisWrite, Ctx } from "./_writes-money"
import { MARKETING_MODULE } from "../../../modules/marketing"
import { generatePost } from "../../../modules/marketing/content/content-service"
import { meterAction } from "../../../modules/platform/integration/metering-guard"

/**
 * Pixi P5 — MARKETING write tools: schedule a social post + create an email
 * (newsletter/broadcast) campaign.
 *
 * Same contract as _writes-social.ts (which they extend): the MODEL supplies only
 * human words — a product, a platform, a subject, a body, an audience. It NEVER
 * supplies a post id, a campaign id, a template id, or the tenant. Every id is
 * resolved server-side, scoped to ctx.tenant. plan() never mutates; apply() calls
 * the SAME marketing-module methods the REST routes use.
 *
 * Both tools are HARD (typed confirm) because they reach — or are scheduled to
 * reach — the OUTSIDE WORLD on the merchant's behalf:
 *   - schedule_social_post publishes a caption PUBLICLY at a future time (mirrors
 *     POST /posts + POST /posts/:id/schedule; copy is metered on AI credits).
 *   - create_email_campaign is a broadcast to customers; sending email is
 *     irreversible. Honesty note: there is no merchant "blast now" route, so
 *     apply() DRAFTS the broadcast (a campaign + a broadcast email template in
 *     Marketing → Campaigns) and NEVER claims to have sent — the merchant sends
 *     it from there. It is HARD so the confirm posture matches the intent.
 */

/* --------------------------------- helpers -------------------------------- */

const q = (req: MedusaRequest) => req.scope.resolve(ContainerRegistrationKeys.QUERY)
const mkOf = (req: MedusaRequest): any => req.scope.resolve(MARKETING_MODULE)
const scOf = (ctx: Ctx): string | null => ctx.tenant?.meta?.sales_channel_id ?? null

/** Turn any thrown error into a short, merchant-safe sentence. */
function friendly(e: any, fallback: string): string {
  const msg = String(e?.message || "")
  if (!msg || msg.length > 160 || /\b(at |Error:|node_modules|SELECT |INSERT )/i.test(msg)) {
    return fallback
  }
  return msg
}

const PLATFORM_LABEL: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  telegram: "Telegram",
  wordpress: "your blog",
}
const labelOf = (p: string): string => PLATFORM_LABEL[p] ?? (p ? p[0].toUpperCase() + p.slice(1) : p)

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
 * Resolve ONE tenant-owned product from free text — only products linked to this
 * store's sales channel, the provisioned SAMPLE never matches, exact title
 * preferred over a unique substring. Mirrors _writes-social's resolveProduct.
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
    .listMarketingSocialAccounts({ tenant_id: ctx.tenant.id }, { take: 200, order: { created_at: "DESC" } })
    .catch(() => [])
  return Array.isArray(rows) ? rows : []
}

/* ========================= 1. schedule_social_post ======================== */

const scheduleSocialPost: JarvisWrite = {
  name: "schedule_social_post",
  description:
    "Schedule a social media post about one of the store's products to a connected account (Facebook, Instagram) to go out at a FUTURE time. Use for 'schedule a post about the Blue Kaftan for tomorrow 9am', 'post my new dress on Facebook this Friday evening'. This publishes PUBLICLY at the scheduled time. For posting right now, use create_social_post instead.",
  parameters: {
    type: "object",
    properties: {
      product_query: { type: "string", description: 'Which product to post about, e.g. "Blue Kaftan".' },
      schedule_at: { type: "string", description: "ISO datetime for when the post should go out (must be in the future)." },
      platform: { type: "string", description: "Optional social platform, e.g. 'facebook' or 'instagram'. Defaults to a connected account." },
      message: { type: "string", description: "Optional caption or angle. If omitted, the AI writes it from the product." },
    },
    required: ["product_query", "schedule_at"],
    additionalProperties: false,
  },
  risk: "high",
  tier: "hard",
  requireText: "SCHEDULE",

  async plan(req, ctx, args) {
    const pr = await resolveProduct(req, ctx, args.product_query)
    if (!pr.ok) return { ok: false, error: pr.error }
    const { product } = pr

    const when = new Date(String(args.schedule_at ?? ""))
    if (isNaN(when.getTime())) return { ok: false, error: "Tell me a valid date and time to schedule the post for." }
    if (when.getTime() <= Date.now()) return { ok: false, error: "Pick a time in the future — to post right now, ask me to post it now instead." }
    const scheduleAt = when.toISOString()

    const accounts = await connectedAccounts(req, ctx)
    if (!accounts.length) return { ok: false, error: "Connect a Facebook/Instagram account in Marketing → Channels first." }

    const requested = normalisePlatform(args.platform)
    let account: any
    if (requested) {
      account = accounts.find((a: any) => a.platform === requested) ?? null
      if (!account) {
        const have = Array.from(new Set(accounts.map((a: any) => labelOf(a.platform)))).join(", ")
        return { ok: false, error: `You don't have a ${labelOf(requested)} account connected. Connected: ${have}. Connect one in Marketing → Channels first.` }
      }
    } else {
      account =
        accounts.find((a: any) => a.platform === "facebook") ??
        accounts.find((a: any) => a.platform === "instagram") ??
        accounts[0]
    }
    const platform = account.platform
    const message = typeof args.message === "string" && args.message.trim() ? args.message.trim() : null

    return {
      ok: true,
      human_summary: `Schedule a post about "${product.title}" to ${labelOf(platform)} for ${new Date(scheduleAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}?`,
      details: { product: product.title, platform: labelOf(platform), schedule_at: scheduleAt, has_caption: !!message },
      apply_args: {
        product_id: product.id,
        product_title: product.title,
        platform,
        social_account_id: account.id,
        prompt: message ?? `Write a short, engaging social media post promoting our product "${product.title}".`,
        schedule_at: scheduleAt,
      },
    }
  },

  async apply(req, ctx, applyArgs) {
    const tenantId = ctx.tenant.id
    const svc = mkOf(req)

    // Re-check the product still belongs to this store before scheduling.
    const pr = await resolveProduct(req, ctx, applyArgs.product_title || "")
    if (!pr.ok || pr.product.id !== applyArgs.product_id) {
      return { result: { ok: false, error: "That product is no longer available in your store." }, undo: { available: false, reason: "Nothing was scheduled." } }
    }
    const scheduleAt = new Date(applyArgs.schedule_at)
    if (isNaN(scheduleAt.getTime())) {
      return { result: { ok: false, error: "That schedule time wasn't valid." }, undo: { available: false, reason: "Nothing was scheduled." } }
    }

    try {
      // 1. Draft shell + the single platform target (mirrors POST /posts).
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
        { tenant_id: tenantId, post_id: postId, platform: applyArgs.platform, social_account_id: applyArgs.social_account_id ?? null, status: "pending" },
      ] as any)

      // 2. Generate the copy, metered on AI credits — SAME action ("ai_text", 1)
      //    the /posts/generate route uses.
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
        return { result: { ok: false, error: "You're out of AI credits — top up in Billing to schedule a post." }, undo: { available: false, reason: "The post copy couldn't be generated." } }
      }

      // 3. SCHEDULE path — mirror POST /posts/:id/schedule exactly.
      const targets = await svc.listMarketingPostTargets({ tenant_id: tenantId, post_id: postId })
      await svc.updateMarketingPostTargets(
        (Array.isArray(targets) ? targets : []).map((t: any) => ({ id: t.id, status: "scheduled", scheduled_at: scheduleAt })) as any
      )
      await svc.updateMarketingPosts({ id: postId, status: "scheduled" } as any)

      return {
        result: { ok: true, post_id: postId, state: "scheduled", scheduled_at: scheduleAt.toISOString() },
        undo: { available: false, reason: "unschedule or delete the post from Marketing → Posts" },
      }
    } catch (e: any) {
      return { result: { ok: false, error: friendly(e, "I couldn't schedule that post.") }, undo: { available: false, reason: "Nothing was scheduled." } }
    }
  },
}

/* ========================= 2. create_email_campaign ====================== */

/** Count subscribable contacts (has an email, not unsubscribed). Tenant-scoped. */
async function subscribableCount(req: MedusaRequest, ctx: Ctx): Promise<number | null> {
  try {
    const mk = mkOf(req)
    const [, count] = await mk.listAndCountMarketingContacts(
      { tenant_id: ctx.tenant.id, unsubscribed_at: null, email: { $ne: null } },
      { take: 1 }
    )
    return typeof count === "number" ? count : null
  } catch {
    return null
  }
}

const createEmailCampaign: JarvisWrite = {
  name: "create_email_campaign",
  description:
    "Prepare an email newsletter/broadcast to the store's customers — a subject and a message. Use for 'email my customers about the weekend sale', 'send a newsletter announcing the new collection'. This is a broadcast to real customers, so it is prepared as a campaign in Marketing → Campaigns for the merchant to send; email cannot be unsent. Give a subject and the message body.",
  parameters: {
    type: "object",
    properties: {
      subject: { type: "string", description: "The email subject line." },
      body: { type: "string", description: "The email message body (plain text or simple HTML)." },
      audience: { type: "string", description: "Optional description of who it's for, e.g. 'all customers', 'repeat buyers'." },
      name: { type: "string", description: "Optional campaign name; defaults to the subject." },
    },
    required: ["subject", "body"],
    additionalProperties: false,
  },
  risk: "high",
  tier: "hard",
  requireText: "SEND",

  async plan(req, ctx, args) {
    const subject = typeof args.subject === "string" ? args.subject.trim() : ""
    const body = typeof args.body === "string" ? args.body.trim() : ""
    if (!subject) return { ok: false, error: "Tell me the email subject line." }
    if (!body) return { ok: false, error: "Tell me what the email should say." }

    const audience = typeof args.audience === "string" && args.audience.trim() ? args.audience.trim() : "all customers"
    const count = await subscribableCount(req, ctx)
    const reach = count == null ? "your customers" : `about ${count} customer${count === 1 ? "" : "s"}`

    return {
      ok: true,
      human_summary: `Prepare an email campaign "${subject}" to ${audience} (${reach})? It's saved in Marketing → Campaigns ready to send — email can't be unsent once you send it.`,
      details: { subject, audience, recipients_estimate: count, note: "Drafted as a campaign for you to review and send from Marketing → Campaigns." },
      apply_args: { subject, body, audience, name: (typeof args.name === "string" && args.name.trim()) ? args.name.trim() : subject },
    }
  },

  async apply(req, ctx, applyArgs) {
    const tenantId = ctx.tenant.id
    const svc = mkOf(req)
    const subject = String(applyArgs.subject || "").trim()
    const body = String(applyArgs.body || "").trim()
    if (!subject || !body) {
      return { result: { ok: false, error: "The email needs a subject and a body." }, undo: { available: false, reason: "Nothing was created." } }
    }
    const html = /<[a-z][\s\S]*>/i.test(body) ? body : `<p>${body.replace(/\n/g, "<br/>")}</p>`

    try {
      // Broadcast template (mirrors POST /marketing/email/templates, kind broadcast).
      const createdTpl = await svc.createMarketingEmailTemplates({
        tenant_id: tenantId,
        name: String(applyArgs.name || subject).slice(0, 200),
        kind: "broadcast",
        subject,
        html,
      } as any)
      const template = Array.isArray(createdTpl) ? createdTpl[0] : createdTpl

      // Campaign container to hold it (mirrors POST /marketing/campaigns, draft).
      const createdCamp = await svc.createMarketingCampaigns({
        tenant_id: tenantId,
        name: String(applyArgs.name || subject).slice(0, 200),
        objective: `Email broadcast: ${applyArgs.audience || "all customers"}`,
        status: "draft",
      } as any)
      const campaign = Array.isArray(createdCamp) ? createdCamp[0] : createdCamp

      return {
        result: {
          ok: true,
          campaign_id: campaign?.id ?? null,
          template_id: template?.id ?? null,
          state: "drafted",
          note: "Your email campaign is drafted in Marketing → Campaigns — review it there and hit send when you're ready. It has NOT been sent yet.",
        },
        undo: { available: false, reason: "delete the draft campaign from Marketing → Campaigns" },
      }
    } catch (e: any) {
      return { result: { ok: false, error: friendly(e, "I couldn't prepare that email campaign.") }, undo: { available: false, reason: "Nothing was created." } }
    }
  },
}

/* -------------------------------- registry ------------------------------- */

export const MARKETING_WRITES: JarvisWrite[] = [scheduleSocialPost, createEmailCampaign]
