import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { CMS_MODULE } from "."
import { PLATFORM_MODULE } from "../platform"
import type CmsModuleService from "./service"
import { emitCmsPublished, publishPageSnapshot } from "./publish-helper"
import {
  DEFAULT_SETTINGS,
  type FooterSettings,
  type HeaderSettings,
  type LocaleMap,
} from "./types"

/**
 * Starter CMS content for pooled mAutomate tenants (signup bootstrap).
 *
 * Each tenant owns its own cms_page / cms_setting rows (scoped by tenant_id).
 * Brand identity is applied per tenant:
 *   - page copy is authored with the {@link STORE_NAME_TOKEN} token in the
 *     STARTER_PAGES templates, and BAKED to the tenant's real store name at
 *     write time (see {@link interpolateStoreName} / {@link renderStarterSections});
 *     read-time interpolation of the token is not wired up for page snapshots,
 *     so baking keeps the storefront output correct with no runtime dependency,
 *   - chrome branding (logo / copyright / SEO) is stamped per tenant by the
 *     storefront's applyTenantBranding.
 *
 * The starter pages cover every default footer link so a fresh tenant's
 * storefront chrome never links to a 404:
 *   /about-us  /store-location  /contact-us  /support-policy  /faqs
 * ("Contact" points at the CMS /contact-us page — the storefront's hardcoded
 * /contact route carries single-tenant Forever Finds boilerplate, which a
 * pooled tenant must never see.)
 *
 * {@link ensureStarterCmsContent} is IDEMPOTENT and non-destructive:
 *   - a page is only created (and published) when no cms_page with its slug
 *     exists; existing pages are never overwritten,
 *   - an existing page that has no live en snapshot is published (repair),
 *   - the header/footer settings singletons are created when missing; when
 *     they exist only dead starter links (href "#" or the boilerplate
 *     "/contact") are repaired — merchant-customised links are left alone.
 * Safe to run on every tenant signup and as a backfill script.
 */

/** Token interpolated with the tenant's store name by the store page API. */
export const STORE_NAME_TOKEN = "{{store_name}}"

const SEED_ACTOR_ID = "platform"

/** Default footer/nav labels -> the starter page routes that satisfy them. */
export const STARTER_LINKS: { label: string; href: string }[] = [
  { label: "About us", href: "/about-us" },
  { label: "Store location", href: "/store-location" },
  { label: "Contact", href: "/contact-us" },
  { label: "Support Policy", href: "/support-policy" },
  { label: "FAQs", href: "/faqs" },
]

/**
 * One draft section on a starter page. `type` is a BLOCK_TYPES value that BOTH
 * storefront engines (Liquid + React) render — the starter layouts use only the
 * three universally-rendered content blocks:
 *   - `rich_text`        headed prose (h2/h3/h4 + p/ul/li/strong/a)
 *   - `image_with_text`  media banner (eyebrow / title / body / CTA)
 * `data` is the en block payload; string fields may embed {@link STORE_NAME_TOKEN},
 * which {@link renderStarterSections} bakes to the tenant's own name at write time.
 */
export type StarterSectionDef = {
  type: "rich_text" | "image_with_text"
  label: string
  data: Record<string, unknown>
}

type StarterPageDef = {
  slug: string
  title: string
  seo_title: string
  seo_description: string
  /** Ordered multi-section layout (rank = array index). */
  sections: StarterSectionDef[]
}

/** Shared media (served app-wide from the storefront public dir, every theme). */
const IMG = "/learts/assets/images/product"

/**
 * Brand-neutral, multi-section starter layouts. Built from the three content
 * blocks every theme renders (rich_text + image_with_text). Copy embeds the
 * {@link STORE_NAME_TOKEN} token; {@link renderStarterSections} bakes it to the
 * store's real name so each tenant's snapshot reads naturally.
 */
export const STARTER_PAGES: StarterPageDef[] = [
  {
    slug: "about-us",
    title: "About us",
    seo_title: `About ${STORE_NAME_TOKEN}`,
    seo_description: `Learn more about ${STORE_NAME_TOKEN} and what we stand for.`,
    sections: [
      {
        type: "image_with_text",
        label: "About hero",
        data: {
          image: `${IMG}/deal-product-1.webp`,
          image_side: "left",
          eyebrow: "Our story",
          title: `Welcome to\n${STORE_NAME_TOKEN}`,
          body: `${STORE_NAME_TOKEN} is an independent online shop built around a simple idea: bring you products you'll love, at fair prices, with service that genuinely cares. Every order is hand-checked, carefully packed and sent with a trusted courier so it reaches you in perfect shape.`,
          cta: { label: "Browse the shop", href: "/store" },
        },
      },
      {
        type: "rich_text",
        label: "What we stand for",
        data: {
          width: "normal",
          html:
            `<h2>What we stand for</h2>\n` +
            `<p>We started ${STORE_NAME_TOKEN} to make online shopping feel personal again. These are the promises behind every order:</p>\n` +
            `<h3>Quality you can trust</h3>\n` +
            `<p>We choose every product with care and stand behind what we sell. If something isn't right, we will make it right.</p>\n` +
            `<h3>Honest, fair pricing</h3>\n` +
            `<p>No inflated prices and no hidden fees — just good products at a price that feels fair.</p>\n` +
            `<h3>Real human support</h3>\n` +
            `<p>Questions, changes or a little advice — a real person on our team is always happy to help, usually within one to two business days.</p>`,
        },
      },
      {
        type: "image_with_text",
        label: "About CTA",
        data: {
          image: `${IMG}/deal-product-2.webp`,
          image_side: "right",
          eyebrow: "Come say hello",
          title: `Have a question?\nWe'd love to hear from you`,
          body: `Whether it's about a product, an order or a recommendation, our team is only a message away. Reach out any time — we're always glad to help.`,
          cta: { label: "Contact us", href: "/contact-us" },
        },
      },
    ],
  },
  {
    slug: "store-location",
    title: "Store location",
    seo_title: `Store location — ${STORE_NAME_TOKEN}`,
    seo_description: `Where to find ${STORE_NAME_TOKEN} and how to reach us.`,
    sections: [
      {
        type: "image_with_text",
        label: "Location hero",
        data: {
          image: `${IMG}/deal-product-1.webp`,
          image_side: "right",
          eyebrow: "Find us",
          title: `Shop ${STORE_NAME_TOKEN}\nfrom anywhere`,
          body: `${STORE_NAME_TOKEN} is an online-first store, so our full range is open to you around the clock — no queues and no closing time. Browse, order and track your delivery whenever it suits you.`,
          cta: { label: "Start shopping", href: "/store" },
        },
      },
      {
        type: "rich_text",
        label: "Visit & delivery",
        data: {
          width: "normal",
          html:
            `<h2>Getting your order</h2>\n` +
            `<p>We ship to your door through trusted courier partners, with tracking shared as soon as your parcel is on its way.</p>\n` +
            `<h3>Local pickup</h3>\n` +
            `<p>Prefer to collect your order in person? Get in touch and we will arrange a convenient time and place.</p>\n` +
            `<h3>Store address &amp; hours</h3>\n` +
            `<p>Our full address and opening hours will be published here soon. In the meantime our team is available online and happy to help — just <a href="/contact-us">contact us</a>.</p>`,
        },
      },
    ],
  },
  {
    slug: "contact-us",
    title: "Contact us",
    seo_title: `Contact ${STORE_NAME_TOKEN}`,
    seo_description: `Get in touch with the ${STORE_NAME_TOKEN} team.`,
    sections: [
      {
        type: "rich_text",
        label: "Contact intro",
        data: {
          width: "narrow",
          html:
            `<h2>Get in touch with ${STORE_NAME_TOKEN}</h2>\n` +
            `<p>We would genuinely love to hear from you. Whether you have a question about a product, need help with an existing order, or just want advice before you buy, our team is here for you.</p>`,
        },
      },
      {
        type: "rich_text",
        label: "Ways to reach us",
        data: {
          width: "normal",
          html:
            `<h3>Ways to reach us</h3>\n` +
            `<ul>\n` +
            `<li><strong>Email:</strong> write to us at the address shown in the site footer — it reaches our support team directly.</li>\n` +
            `<li><strong>Your order emails:</strong> simply reply to any order confirmation and your message comes straight to us.</li>\n` +
            `<li><strong>Social media:</strong> send us a message on any of the channels linked in the footer.</li>\n` +
            `</ul>\n` +
            `<h3>When you'll hear back</h3>\n` +
            `<p>We aim to reply to every message within one to two business days — often much sooner. Thanks for your patience, and for shopping with ${STORE_NAME_TOKEN}.</p>`,
        },
      },
    ],
  },
  {
    slug: "support-policy",
    title: "Support Policy",
    seo_title: `Support Policy — ${STORE_NAME_TOKEN}`,
    seo_description: `How ${STORE_NAME_TOKEN} handles support, shipping and returns.`,
    sections: [
      {
        type: "rich_text",
        label: "Support intro",
        data: {
          width: "narrow",
          html:
            `<h2>Support policy</h2>\n` +
            `<p>At ${STORE_NAME_TOKEN} we want every purchase to feel easy and worry-free. Here is a clear summary of how we handle support, shipping, returns and refunds.</p>`,
        },
      },
      {
        type: "rich_text",
        label: "Support & shipping",
        data: {
          width: "normal",
          html:
            `<h3>Customer support</h3>\n` +
            `<p>Our team is here to help with anything you need. Reach us through the options on our <a href="/contact-us">contact page</a> and we will get back to you within one to two business days.</p>\n` +
            `<h3>Shipping</h3>\n` +
            `<p>Orders are processed within one to two business days. Delivery times depend on your location and the courier, and we share tracking details as soon as your order ships.</p>`,
        },
      },
      {
        type: "rich_text",
        label: "Returns & refunds",
        data: {
          width: "normal",
          html:
            `<h3>Returns &amp; refunds</h3>\n` +
            `<p>If something is not right, contact us within seven days of delivery. Items returned unused and in their original packaging are eligible for an exchange or refund once we have inspected them.</p>\n` +
            `<h3>Order changes &amp; cancellations</h3>\n` +
            `<p>Need to change or cancel an order? Get in touch as soon as possible. If it has not shipped yet, we will do our very best to help.</p>`,
        },
      },
    ],
  },
  {
    slug: "faqs",
    title: "FAQs",
    seo_title: `Frequently Asked Questions — ${STORE_NAME_TOKEN}`,
    seo_description: `Answers to common questions about shopping with ${STORE_NAME_TOKEN}.`,
    sections: [
      {
        type: "rich_text",
        label: "FAQ intro",
        data: {
          width: "narrow",
          html:
            `<h2>Frequently asked questions</h2>\n` +
            `<p>Everything you need to know about shopping with ${STORE_NAME_TOKEN}. Can't find your answer? <a href="/contact-us">Contact us</a> — we are always happy to help.</p>`,
        },
      },
      {
        type: "rich_text",
        label: "Ordering & payment",
        data: {
          width: "normal",
          html:
            `<h3>Ordering &amp; payment</h3>\n` +
            `<h4>How do I place an order?</h4>\n` +
            `<p>Browse the shop, add the items you love to your cart and follow the checkout steps. You will receive a confirmation email as soon as your order is placed.</p>\n` +
            `<h4>What payment methods do you accept?</h4>\n` +
            `<p>All the payment options available to you are shown securely at checkout.</p>\n` +
            `<h4>Can I change or cancel my order?</h4>\n` +
            `<p>Contact us as soon as possible — if your order has not shipped yet, we will do our best to update or cancel it.</p>`,
        },
      },
      {
        type: "rich_text",
        label: "Shipping, returns & help",
        data: {
          width: "normal",
          html:
            `<h3>Shipping, returns &amp; help</h3>\n` +
            `<h4>How can I track my order?</h4>\n` +
            `<p>As soon as your order ships we send you the tracking details. You can also check your order status from your account page.</p>\n` +
            `<h4>Can I return an item?</h4>\n` +
            `<p>Yes. See our <a href="/support-policy">Support Policy</a> for the return window and conditions.</p>\n` +
            `<h4>How do I get in touch?</h4>\n` +
            `<p>Visit our <a href="/contact-us">contact page</a> — we aim to reply within one to two business days.</p>`,
        },
      },
    ],
  },
]

/**
 * Deep-replace {@link STORE_NAME_TOKEN} with the store's real name across every
 * string in a value (arrays + nested objects included). Read-time interpolation
 * of the token is not wired up for page snapshots, so the name is BAKED into the
 * section data at write time — the storefront then renders the store's own name
 * with no runtime dependency. Returns a fresh, mutation-safe copy.
 */
export function interpolateStoreName<T>(value: T, storeName: string): T {
  const name = (storeName ?? "").trim() || "our store"
  const walk = (v: any): any => {
    if (typeof v === "string") {
      return v.split(STORE_NAME_TOKEN).join(name)
    }
    if (Array.isArray(v)) {
      return v.map(walk)
    }
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v)) {
        out[k] = walk(val)
      }
      return out
    }
    return v
  }
  return walk(value)
}

/**
 * The ordered, ready-to-write starter sections for a page slug, with the store
 * name baked in. Shared single source of truth for the signup seed AND the
 * reseed migration so both produce byte-identical section rows. Returns [] for
 * an unknown slug.
 */
export function renderStarterSections(
  slug: string,
  storeName: string
): { type: string; label: string; rank: number; enabled: boolean; data: Record<string, unknown> }[] {
  const def = STARTER_PAGES.find((p) => p.slug === slug)
  if (!def) {
    return []
  }
  return def.sections.map((section, rank) => ({
    type: section.type,
    label: section.label,
    rank,
    enabled: true,
    data: interpolateStoreName(section.data, storeName),
  }))
}

/** What one ensure run did (for logs / step output). */
export type StarterCmsSummary = {
  pages_created: string[]
  pages_published: string[]
  pages_skipped: string[]
  settings_created: string[]
  settings_updated: string[]
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function one<T>(result: T | T[]): T {
  return Array.isArray(result) ? result[0] : result
}

/**
 * Repair starter nav links in place: only hrefs that are dead ("#", empty) or
 * the single-tenant "/contact" boilerplate are rewritten — anything a merchant
 * customised is preserved. Returns true when a link changed.
 */
function repairStarterLinks(
  links: { label?: string; href?: string }[] | undefined
): boolean {
  if (!Array.isArray(links)) {
    return false
  }
  let changed = false
  for (const link of links) {
    const target = STARTER_LINKS.find(
      (s) => s.label.toLowerCase() === (link.label ?? "").trim().toLowerCase()
    )
    if (!target) {
      continue
    }
    const href = (link.href ?? "").trim()
    if (href === "" || href === "#" || href === "/contact") {
      link.href = target.href
      changed = true
    }
  }
  return changed
}

/** The seeded footer singleton (en): defaults + working starter links. */
function buildFooterEn(): FooterSettings {
  const footer = clone(DEFAULT_SETTINGS.footer)
  footer.column_links = clone(STARTER_LINKS)
  // Neutralise single-tenant Forever Finds boilerplate. The storefront's
  // applyTenantBranding re-stamps copyright/logo per tenant on every request.
  footer.contact.email = "support@mautomate.ai"
  footer.copyright = "© {year} Our Store. All Rights Reserved"
  return footer
}

/** The seeded header singleton (en): defaults + CMS contact route. */
function buildHeaderEn(): HeaderSettings {
  const header = clone(DEFAULT_SETTINGS.header)
  repairStarterLinks(header.menu as { label?: string; href?: string }[])
  return header
}

async function ensureSetting(
  cmsService: CmsModuleService,
  container: MedusaContainer,
  tenantId: string,
  key: "header" | "footer",
  buildEn: () => HeaderSettings | FooterSettings,
  summary: StarterCmsSummary
): Promise<void> {
  const rows = await cmsService.listCmsSettings({ tenant_id: tenantId, key })
  const existing = (rows?.[0] as any) ?? null
  let written: LocaleMap<any>

  if (!existing) {
    written = { en: buildEn(), bn: {} }
    await cmsService.createCmsSettings({ tenant_id: tenantId, key, data: written })
    summary.settings_created.push(key)
  } else {
    // Non-destructive repair: only fix dead starter links inside the stored en
    // slice; every other merchant-owned field is left untouched.
    const data = clone(existing.data ?? {}) as any
    const en = data?.en ?? {}
    const links = key === "footer" ? en.column_links : en.menu
    if (!repairStarterLinks(links)) {
      return
    }
    written = data
    await cmsService.updateCmsSettings({ id: existing.id, data })
    summary.settings_updated.push(key)
  }

  // Purge the storefront's cached chrome (tag "cms-settings") — best-effort.
  await emitCmsPublished(container, {
    entity_type: "global",
    slug: key,
    locale: null,
    tenant_id: tenantId,
  })

  // Audit trail (best-effort, mirrors seed-cms-settings.ts).
  try {
    await cmsService.createCmsAuditLogs({
      tenant_id: tenantId,
      actor_id: SEED_ACTOR_ID,
      actor_email: null,
      action: existing ? "setting.update" : "setting.create",
      entity_type: "global_setting",
      entity_key: key,
      before: existing?.data ?? null,
      after: written,
    })
  } catch {
    // non-blocking
  }
}

async function hasLiveSnapshot(
  cmsService: CmsModuleService,
  tenantId: string,
  slug: string
): Promise<boolean> {
  const rows = await cmsService.listCmsSnapshots(
    { tenant_id: tenantId, entity_type: "page", slug, locale: "en", is_live: true },
    { take: 1 }
  )
  return Boolean(rows?.length)
}

/**
 * Ensure the shared starter CMS content exists and is live. Called from the
 * tenant signup bootstrap (best-effort step) and the backfill script.
 */
export async function ensureStarterCmsContent(
  container: MedusaContainer,
  tenantId: string
): Promise<StarterCmsSummary> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const cmsService = container.resolve<CmsModuleService>(CMS_MODULE)

  if (!tenantId) {
    throw new Error(
      "ensureStarterCmsContent requires a tenantId (pooled multi-tenant)."
    )
  }

  // Resolve the store's own name so it can be baked into the starter copy
  // (read-time token interpolation is not wired up for page snapshots).
  let storeName = ""
  try {
    const platform: any = container.resolve(PLATFORM_MODULE)
    const tenant: any = await platform.retrieveTenant(tenantId)
    storeName = (tenant?.name ?? "").trim()
  } catch {
    // Fall back to a neutral phrasing inside interpolateStoreName.
  }

  const summary: StarterCmsSummary = {
    pages_created: [],
    pages_published: [],
    pages_skipped: [],
    settings_created: [],
    settings_updated: [],
  }

  /* ---- 1. Starter pages (create-if-missing, then publish en) ---------- */
  for (const def of STARTER_PAGES) {
    const existing = await cmsService.listCmsPages({
      tenant_id: tenantId,
      slug: def.slug,
    })
    let page: any = existing?.[0] ?? null

    if (page) {
      // Never overwrite an existing page; only repair a missing live snapshot.
      if (await hasLiveSnapshot(cmsService, tenantId, def.slug)) {
        summary.pages_skipped.push(def.slug)
        continue
      }
    } else {
      page = one(
        await cmsService.createCmsPages({
          tenant_id: tenantId,
          slug: def.slug,
          title: def.title,
          status: "active",
          is_home: false,
          default_locale: "en",
          fallback_locale: "en",
          seo_title: interpolateStoreName(def.seo_title, storeName),
          seo_description: interpolateStoreName(def.seo_description, storeName),
        })
      )
      for (const section of renderStarterSections(def.slug, storeName)) {
        await cmsService.createCmsSections({
          tenant_id: tenantId,
          page_id: page.id,
          type: section.type,
          label: section.label,
          rank: section.rank,
          enabled: section.enabled,
          data: section.data,
        })
      }
      summary.pages_created.push(def.slug)
    }

    const published = await publishPageSnapshot(container, {
      pageId: page.id,
      tenant_id: tenantId,
      locale: "en",
      published_by: SEED_ACTOR_ID,
      note: "starter page seed",
    })
    if (!published.ok) {
      throw new Error(
        `starter page "${def.slug}" failed to publish: ${published.errors.join(
          "; "
        )}`
      )
    }
    summary.pages_published.push(def.slug)
  }

  /* ---- 2. Chrome settings (footer/header links -> the starter pages) -- */
  await ensureSetting(cmsService, container, tenantId, "footer", buildFooterEn, summary)
  await ensureSetting(cmsService, container, tenantId, "header", buildHeaderEn, summary)

  logger.info(
    `[cms] starter content ensured — pages created: [${summary.pages_created.join(
      ", "
    )}], published: [${summary.pages_published.join(
      ", "
    )}], skipped: [${summary.pages_skipped.join(
      ", "
    )}], settings created: [${summary.settings_created.join(
      ", "
    )}], repaired: [${summary.settings_updated.join(", ")}]`
  )

  return summary
}
