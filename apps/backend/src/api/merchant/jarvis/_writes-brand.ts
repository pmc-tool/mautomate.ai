import { MedusaRequest } from "@medusajs/framework/http"
import type { JarvisWrite, Ctx } from "./_writes-money"
import {
  THEME_CATALOG,
  catalogWithPreviewUrls,
  isKnownTheme,
} from "../../admin/cms/themes/_catalog"
import { THEME_MODULE } from "../../../modules/theme"
import { demoteLiveHome } from "../_theme-content"
import {
  generateSetupLogos,
} from "../../../modules/marketing/ai/logo-generator"
import { getLedger, withCredits } from "../../../modules/platform/credits/metering"
import { syncStoreLogoToCms } from "../_cms-sync"
import { domainEntitlement } from "../_helpers"
import { DomainRoutingService } from "../../../modules/platform/domain-routing"

/**
 * Pixi P5 — BRAND write tools: theme, AI logo generation + set, domain connect.
 *
 * Same hard wall between deciding (plan, never mutates) and doing (apply, the
 * only place that mutates) as every other Pixi write registry, and the SAME
 * contract shape so this array can be concatenated straight into WRITES:
 *
 *   - The MODEL only ever supplies human words — a theme name, a logo brief, a
 *     domain. It NEVER supplies a tenant, a theme id it hasn't been shown, or an
 *     internal id. Tenancy is ALWAYS `ctx.tenant` (session), never an arg.
 *   - plan() resolves the words into a concrete, tenant-owned target, validates
 *     it (theme exists + entitled, domain well-formed + not taken, AI configured)
 *     and returns a precise human_summary for the confirm card. Bad input comes
 *     back as { ok:false, error } — a friendly sentence, never a stack trace.
 *   - apply() replicates EXACTLY what the matching REST route does — PUT
 *     /merchant/theme for the switch, POST /merchant/setup/logo/generate (metered
 *     on the tenant's AI credits) for the logo, POST /merchant/domains for the
 *     connect — and never leaks an internal error.
 *
 * TIERS:
 *   - switch_theme is HARD (typed "SWITCH"): it changes the LIVE storefront look
 *     for every visitor and, in the default fresh mode, resets the home design.
 *   - connect_domain is HARD (typed "CONNECT"): it provisions a real custom
 *     hostname and is a guided/external action (the merchant must still change
 *     nameservers at their own registrar afterwards).
 *   - generate_logo / set_logo are SOFT (one-tap) — generate SPENDS AI credits
 *     (called out in the summary) but changes nothing on the store; set only
 *     swaps the logo and is self-reversing.
 */

/* -------------------------------- helpers -------------------------------- */

/** Turn any thrown error into a short, merchant-safe sentence. */
function friendly(e: any, fallback: string): string {
  const msg = String(e?.message || "")
  if (!msg || msg.length > 160 || /\b(at |Error:|node_modules|SELECT |INSERT )/i.test(msg)) {
    return fallback
  }
  return msg
}

type ThemeOption = { id: string; name: string; engine: "react" | "liquid" }

/**
 * The full theme gallery this store may apply — the entitlement-filtered
 * compiled catalog PLUS the published uploaded (Liquid) library. Mirrors the
 * GET /merchant/themes builder so the model resolves against exactly what the
 * merchant would see. Read-only, tenant-scoped, never throws.
 */
async function listApplicableThemes(req: MedusaRequest, ctx: Ctx): Promise<ThemeOption[]> {
  const catalogIds = THEME_CATALOG.map((t) => t.id)
  const allowed: string[] = Array.isArray(ctx.tenant.meta?.allowed_themes)
    ? ctx.tenant.meta.allowed_themes.filter((i: string) => catalogIds.includes(i))
    : catalogIds

  const storefrontUrl =
    process.env.STOREFRONT_PREVIEW_URL ||
    process.env.STOREFRONT_URL ||
    "https://storefront.mautomate.ai"

  const compiled: ThemeOption[] = catalogWithPreviewUrls(storefrontUrl)
    .filter((t) => allowed.includes(t.id))
    .map((t) => ({ id: t.id, name: t.name, engine: "react" as const }))

  let uploaded: ThemeOption[] = []
  try {
    const svc: any = req.scope.resolve(THEME_MODULE)
    const themes = await svc.listThemes({ status: "published", visibility: "public" })
    uploaded = (themes || []).map((t: any) => ({
      id: t.handle,
      name: t.name,
      engine: "liquid" as const,
    }))
  } catch {
    // Theme module unavailable — the compiled catalog stands alone.
  }
  return [...compiled, ...uploaded]
}

/** Resolve a spoken theme name/handle to ONE applicable theme, or an error. */
function resolveTheme(
  themes: ThemeOption[],
  term: string
): { ok: true; theme: ThemeOption } | { ok: false; error: string } {
  const needle = String(term || "").toLowerCase().trim()
  if (!needle) return { ok: false, error: "Which theme would you like — tell me its name." }
  const byId = themes.find((t) => t.id.toLowerCase() === needle)
  if (byId) return { ok: true, theme: byId }
  const exact = themes.filter((t) => t.name.toLowerCase() === needle)
  const partial = themes.filter(
    (t) => t.name.toLowerCase().includes(needle) || t.id.toLowerCase().includes(needle)
  )
  const matches = exact.length ? exact : partial
  if (!matches.length) {
    const names = themes.slice(0, 8).map((t) => `"${t.name}"`).join(", ")
    return { ok: false, error: `I couldn't find a theme called "${term}". Available: ${names}.` }
  }
  if (matches.length > 1) {
    const names = matches.slice(0, 5).map((t) => `"${t.name}"`).join(", ")
    return { ok: false, error: `That matched ${matches.length} themes (${names}). Which one?` }
  }
  return { ok: true, theme: matches[0] }
}

const normalizeDomain = (raw: unknown): string =>
  String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")

/* ============================== 1. switch_theme =========================== */

const switchTheme: JarvisWrite = {
  name: "switch_theme",
  description:
    "Switch the store's LIVE storefront theme to a different design. Use for 'change my theme to Cignet', 'use the Learts theme', 'switch my storefront design'. This changes how the storefront looks to every visitor and, by default, resets the home page to the new theme's own design (the old design is kept in history). Give the theme name.",
  parameters: {
    type: "object",
    properties: {
      theme: { type: "string", description: "The theme name or handle, e.g. 'Cignet' or 'learts-liquid'." },
      keep_home: {
        type: "boolean",
        description:
          "Optional. true = keep the current home content instead of resetting to the new theme's default design. Defaults to false (fresh install).",
      },
    },
    required: ["theme"],
    additionalProperties: false,
  },
  risk: "high",
  tier: "hard",
  requireText: "SWITCH",

  async plan(req, ctx, args) {
    const themes = await listApplicableThemes(req, ctx)
    if (!themes.length) return { ok: false, error: "No themes are available on your store yet." }

    const r = resolveTheme(themes, args.theme)
    if (!r.ok) return { ok: false, error: r.error }
    const { theme } = r

    const current = String(ctx.tenant.meta?.active_theme ?? "").trim()
    if (current === theme.id) {
      return { ok: false, error: `"${theme.name}" is already your active theme.` }
    }
    const mode = args.keep_home === true ? "keep" : "fresh"

    return {
      ok: true,
      human_summary:
        mode === "fresh"
          ? `Switch your live storefront theme to "${theme.name}"? This changes how your store looks to every visitor and resets your home page to the new theme's design (your current design is kept in history and can be restored).`
          : `Switch your live storefront theme to "${theme.name}", keeping your current home content? This changes how your store looks to every visitor.`,
      details: {
        theme: theme.name,
        theme_id: theme.id,
        engine: theme.engine,
        mode,
        from: current || null,
      },
      apply_args: { theme_id: theme.id, theme_name: theme.name, mode, previous_theme: current || null },
    }
  },

  async apply(req, ctx, applyArgs) {
    const themeId = String(applyArgs.theme_id || "").trim()
    const mode = applyArgs.mode === "keep" ? "keep" : "fresh"

    // Re-validate ownership/entitlement exactly like PUT /merchant/theme, so a
    // leaked/forged confirm token still can't apply a theme off this plan.
    let known = isKnownTheme(themeId)
    if (!known) {
      try {
        const svc: any = req.scope.resolve(THEME_MODULE)
        const rows = await svc.listThemes({ handle: themeId, status: "published" })
        known = (rows?.length ?? 0) > 0
      } catch {
        known = false
      }
    }
    if (!themeId || !known) {
      return {
        result: { ok: false, error: "That theme is no longer available." },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
    if (isKnownTheme(themeId)) {
      const allowed: string[] | null = Array.isArray(ctx.tenant.meta?.allowed_themes)
        ? ctx.tenant.meta.allowed_themes
        : null
      if (allowed && !allowed.includes(themeId)) {
        return {
          result: { ok: false, error: "That theme isn't available on your plan." },
          undo: { available: false, reason: "Nothing was changed." },
        }
      }
    }

    try {
      const prevTheme = String(ctx.tenant.meta?.active_theme ?? "").trim()
      const isSwitch = prevTheme !== themeId

      await ctx.svc.updateTenants({
        id: ctx.tenant.id,
        meta: { ...(ctx.tenant.meta ?? {}), active_theme: themeId },
      })

      let reset = false
      if (mode === "fresh" && isSwitch) {
        try {
          const demoted = await demoteLiveHome(req.scope, ctx.tenant.id)
          reset = demoted > 0
        } catch {
          reset = false
        }
      }

      return {
        result: { ok: true, active_theme: themeId, theme: applyArgs.theme_name ?? themeId, mode, reset },
        // A fresh switch demotes the previous home design (kept in history); a
        // clean auto-undo can't restore that, so we guide instead of pretending.
        undo: {
          available: false,
          reason:
            "Your previous theme's home design is kept in history — restore it from CMS → Themes if you want it back.",
        },
      }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "I couldn't switch your theme.") },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* ============================= 2. generate_logo ========================== */

const generateLogo: JarvisWrite = {
  name: "generate_logo",
  description:
    "Generate logo options for the store with AI from a short brief. Use for 'design me a logo', 'make a logo for my jewellery shop', 'create a minimalist logo with a leaf'. This uses the store's AI credits (image generation). It returns the generated logo images so the merchant can pick one; it does NOT change the store logo by itself — use set_logo to apply one.",
  parameters: {
    type: "object",
    properties: {
      brief: {
        type: "string",
        description: "What the logo should look like, e.g. 'a minimalist gold leaf for a jewellery brand'.",
      },
      count: { type: "number", description: "How many options to generate (1-4, default 2)." },
    },
    required: ["brief"],
    additionalProperties: false,
  },
  risk: "low",
  tier: "soft",

  async plan(req, ctx, args) {
    const brief = typeof args.brief === "string" ? args.brief.trim() : ""
    if (!brief) return { ok: false, error: "Tell me what you'd like the logo to look like." }
    if (process.env.AI_EDITOR_ENABLED === "0") return { ok: false, error: "AI is turned off on this store." }
    if (!process.env.NOVITA_API_KEY) return { ok: false, error: "Logo generation isn't configured on this store." }

    const count = Math.max(1, Math.min(4, Number(args.count) || 2))
    return {
      ok: true,
      human_summary: `Generate ${count} logo option${count > 1 ? "s" : ""} with AI from your brief? This uses your AI credits (image generation).`,
      details: { brief, count, note: "Uses AI credits — nothing on your store changes; you pick and apply one after." },
      apply_args: { brief, count },
    }
  },

  async apply(req, ctx, applyArgs) {
    if (process.env.AI_EDITOR_ENABLED === "0") {
      return { result: { ok: false, error: "AI is turned off on this store." }, undo: { available: false, reason: "Nothing was changed." } }
    }
    if (!process.env.NOVITA_API_KEY) {
      return { result: { ok: false, error: "Logo generation isn't configured on this store." }, undo: { available: false, reason: "Nothing was changed." } }
    }

    const count = Math.max(1, Math.min(4, Number(applyArgs.count) || 2))
    const meta = (ctx.tenant.meta ?? {}) as Record<string, any>
    const ledger = getLedger(req.scope)

    try {
      // Metered EXACTLY like POST /merchant/setup/logo/generate: reserve on the
      // "ai_logo" action, charge for what was actually produced, auto-release on
      // failure (a failed run is never charged).
      const outcome = await withCredits(
        ledger,
        ctx.tenant.id,
        "ai_logo",
        count,
        async () => {
          const logos = await generateSetupLogos(req.scope, ctx.tenant.id, {
            brandName: ctx.tenant.name || undefined,
            category: (meta.business as any)?.category || undefined,
            prompt: applyArgs.brief,
            count,
          })
          return { result: logos, actualUnits: logos.length }
        }
      )
      if (!outcome.ok) {
        return {
          result: { ok: false, error: "You're out of AI credits for logo generation — top up in Billing." },
          undo: { available: false, reason: "Nothing was changed." },
        }
      }
      return {
        result: {
          ok: true,
          logos: outcome.result,
          credits_used: outcome.credits,
          note: "Pick one and I can set it as your store logo.",
        },
        // Generated images don't touch the store; nothing to undo.
        undo: { available: false, reason: "Generating options doesn't change your store." },
      }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "Logo generation failed.") },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* =============================== 3. set_logo ============================= */

const setLogo: JarvisWrite = {
  name: "set_logo",
  description:
    "Set the store's logo to a specific image URL — typically one just generated with generate_logo. Use for 'use the first one', 'set that as my logo', 'apply this logo'. Give the logo image URL.",
  parameters: {
    type: "object",
    properties: {
      logo_url: { type: "string", description: "The image URL to use as the store logo." },
    },
    required: ["logo_url"],
    additionalProperties: false,
  },
  risk: "low",
  tier: "soft",

  async plan(req, ctx, args) {
    const url = typeof args.logo_url === "string" ? args.logo_url.trim() : ""
    if (!/^https?:\/\/\S+$/.test(url)) {
      return { ok: false, error: "Give me the logo image URL to set (for example one you just generated)." }
    }
    const prev = String((ctx.tenant.meta ?? {}).logo_url ?? "") || null
    if (prev === url) return { ok: false, error: "That's already your store logo." }
    return {
      ok: true,
      human_summary: "Set this image as your store logo?",
      details: { logo_url: url, replacing: prev },
      apply_args: { logo_url: url, previous_logo_url: prev },
    }
  },

  async apply(req, ctx, applyArgs) {
    const url = String(applyArgs.logo_url || "").trim()
    if (!/^https?:\/\/\S+$/.test(url)) {
      return { result: { ok: false, error: "That logo URL isn't valid." }, undo: { available: false, reason: "Nothing was changed." } }
    }
    try {
      // Replicates the persistence side of POST /merchant/setup/logo: stamp
      // tenant.meta.logo_url and mirror into the CMS chrome the storefront renders.
      const meta = { ...((ctx.tenant.meta ?? {}) as Record<string, any>), logo_url: url }
      await ctx.svc.updateTenants({ id: ctx.tenant.id, meta })
      await syncStoreLogoToCms(req.scope, ctx.tenant.id, url).catch(() => {})

      const prev = String(applyArgs.previous_logo_url || "") || null
      const undo = prev
        ? { action: "set_logo", apply_args: { logo_url: prev, previous_logo_url: url } }
        : { available: false as const, reason: "Your store had no logo before, so there's nothing to revert to." }
      return { result: { ok: true, logo_url: url }, undo }
    } catch (e: any) {
      return { result: { ok: false, error: friendly(e, "I couldn't set your store logo.") }, undo: { available: false, reason: "Nothing was changed." } }
    }
  },
}

/* ============================= 4. connect_domain ========================= */

const ROOT = process.env.PLATFORM_ROOT_DOMAIN ?? "mautomate.ai"

const connectDomain: JarvisWrite = {
  name: "connect_domain",
  description:
    "Begin connecting the merchant's OWN custom domain to their store (e.g. shop.yourbrand.com). Use for 'connect my domain example.com', 'use my own domain'. This starts the connection and returns the exact DNS/nameserver change the merchant must then make at their own registrar to finish — you cannot change settings at their registrar for them. Give the domain.",
  parameters: {
    type: "object",
    properties: {
      domain: { type: "string", description: "The custom domain to connect, e.g. 'shop.yourbrand.com'." },
    },
    required: ["domain"],
    additionalProperties: false,
  },
  risk: "high",
  tier: "hard",
  requireText: "CONNECT",

  async plan(req, ctx, args) {
    const raw = normalizeDomain(args.domain)
    if (!/^([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/.test(raw)) {
      return { ok: false, error: "Enter a valid domain, e.g. shop.yourbrand.com." }
    }
    if (raw.endsWith(`.${ROOT}`) || raw === ROOT) {
      return { ok: false, error: `That is a ${ROOT} address — connect your OWN domain instead.` }
    }
    // A domain can belong to only one store.
    const existing = await ctx.svc.listTenantDomains({ domain: raw }, { take: 1 }).catch(() => [])
    if (existing?.length) {
      const mine = existing[0]?.tenant_id === ctx.tenant.id
      return {
        ok: false,
        error: mine ? `${raw} is already connected to your store.` : `${raw} is already connected to another store.`,
      }
    }
    // Plan entitlement (real gate replicated at apply too).
    const ent = await domainEntitlement(ctx)
    if (!ent.ok) return { ok: false, error: ent.message || "Custom domains aren't available on your plan." }

    return {
      ok: true,
      human_summary: `Start connecting ${raw} to your store? After I set it up, you'll need to change your domain's nameservers/DNS at your registrar to finish — I can't do that step for you.`,
      details: { domain: raw, note: "You finish by changing nameservers/DNS at your registrar, then click Verify in Settings → Domains." },
      apply_args: { domain: raw },
    }
  },

  async apply(req, ctx, applyArgs) {
    const raw = normalizeDomain(applyArgs.domain)
    if (!/^([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/.test(raw) || raw.endsWith(`.${ROOT}`) || raw === ROOT) {
      return { result: { ok: false, error: "That domain isn't valid." }, undo: { available: false, reason: "Nothing was changed." } }
    }
    // Re-check dedup + entitlement at apply, exactly like POST /merchant/domains.
    const existing = await ctx.svc.listTenantDomains({ domain: raw }, { take: 1 }).catch(() => [])
    if (existing?.length) {
      return { result: { ok: false, error: `${raw} is already connected to a store.` }, undo: { available: false, reason: "Nothing was changed." } }
    }
    const ent = await domainEntitlement(ctx)
    if (!ent.ok) {
      return { result: { ok: false, error: ent.message || "Custom domains aren't available on your plan." }, undo: { available: false, reason: "Nothing was changed." } }
    }

    try {
      const routing = new DomainRoutingService(req.scope as any)
      const r = await routing.connectCustomDomain(ctx.tenant.id, raw)
      if (!r.ok) {
        const errStr = r.error ?? ""
        let msg = errStr || "I couldn't connect that domain."
        if (/capacity_reached|capacity/i.test(errStr)) {
          msg = "We've reached the maximum number of custom domains for now — please contact support to raise the limit."
        } else if (/quota|SSL for SaaS|not been granted|not_configured|provision|allocat|Requires permission/i.test(errStr)) {
          msg = "Custom domains aren't available on this store yet — our team is enabling them. Please try again shortly or contact support."
        }
        return { result: { ok: false, error: msg }, undo: { available: false, reason: "Nothing was changed." } }
      }
      const isNs = (r.instructions || []).some((i: any) => i.kind === "ns")
      return {
        result: {
          ok: true,
          domain: raw,
          domain_id: r.domain_id,
          instructions: r.instructions,
          next_step: isNs
            ? "Change your domain's nameservers at your registrar to the two shown, then click Verify in Settings → Domains."
            : "Add this DNS record at your domain provider, then click Verify in Settings → Domains.",
        },
        undo: { available: false, reason: "Disconnect it from Settings → Domains if you change your mind." },
      }
    } catch (e: any) {
      return { result: { ok: false, error: friendly(e, "I couldn't connect that domain.") }, undo: { available: false, reason: "Nothing was changed." } }
    }
  },
}

/* -------------------------------- registry ------------------------------- */

export const BRAND_WRITES: JarvisWrite[] = [switchTheme, generateLogo, setLogo, connectDomain]
