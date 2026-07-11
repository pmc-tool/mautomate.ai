import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { CMS_MODULE } from "."
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
 * In the shared-pooled model every tenant's storefront reads the SAME
 * cms_page / cms_setting tables (page slugs are globally unique), so the
 * starter pages are seeded ONCE and shared by all pooled tenants. Brand
 * identity stays per tenant at read time:
 *   - page copy uses the {@link STORE_NAME_TOKEN} token, which the store read
 *     API (GET /store/cms/pages/:slug) interpolates with the requesting
 *     tenant's name (resolved from its publishable key),
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

type StarterPageDef = {
  slug: string
  title: string
  seo_title: string
  seo_description: string
  /** rich_text html body (en). May contain {@link STORE_NAME_TOKEN}. */
  html: string
}

/**
 * Brand-neutral starter copy. Uses only the rich_text registry block; the
 * {{store_name}} token is replaced per request by the store read API, so the
 * SAME shared snapshot renders under each tenant's own name.
 */
export const STARTER_PAGES: StarterPageDef[] = [
  {
    slug: "about-us",
    title: "About us",
    seo_title: `About ${STORE_NAME_TOKEN}`,
    seo_description: `Learn more about ${STORE_NAME_TOKEN} and what we stand for.`,
    html:
      `<h2>About ${STORE_NAME_TOKEN}</h2>\n` +
      `<p>Welcome to ${STORE_NAME_TOKEN}. We are an independent online store dedicated to bringing you quality products at fair prices, backed by friendly and responsive customer service.</p>\n` +
      `<p>Every order is picked and packed with care, and we work with trusted delivery partners so your purchase reaches you safely and on time.</p>\n` +
      `<p>Have a question? <a href="/contact-us">Get in touch</a> — we would love to hear from you.</p>`,
  },
  {
    slug: "store-location",
    title: "Store location",
    seo_title: `Store location — ${STORE_NAME_TOKEN}`,
    seo_description: `Where to find ${STORE_NAME_TOKEN} and how to reach us.`,
    html:
      `<h2>Store location</h2>\n` +
      `<p>${STORE_NAME_TOKEN} is an online-first store — you can shop with us from anywhere, at any time.</p>\n` +
      `<p>Our full address and pickup information will be published on this page soon. Until then, please reach out through our <a href="/contact-us">contact page</a> and we will gladly help with pickup, delivery or any other questions.</p>`,
  },
  {
    slug: "contact-us",
    title: "Contact us",
    seo_title: `Contact ${STORE_NAME_TOKEN}`,
    seo_description: `Get in touch with the ${STORE_NAME_TOKEN} team.`,
    html:
      `<h2>Contact ${STORE_NAME_TOKEN}</h2>\n` +
      `<p>We would love to hear from you. Whether you have a question about a product, an existing order, shipping or returns, our team is happy to help.</p>\n` +
      `<ul>\n` +
      `<li>Send us a message using the email address shown in the site footer.</li>\n` +
      `<li>Reply to any order confirmation email — it reaches our support team directly.</li>\n` +
      `<li>Reach out on our social channels linked in the footer.</li>\n` +
      `</ul>\n` +
      `<p>We aim to answer every message within one to two business days.</p>`,
  },
  {
    slug: "support-policy",
    title: "Support Policy",
    seo_title: `Support Policy — ${STORE_NAME_TOKEN}`,
    seo_description: `How ${STORE_NAME_TOKEN} handles support, shipping and returns.`,
    html:
      `<h2>Support Policy</h2>\n` +
      `<p>${STORE_NAME_TOKEN} wants every purchase to be a great experience. This page summarises how we handle support, shipping and returns.</p>\n` +
      `<h3>Customer support</h3>\n` +
      `<p>Our team responds to questions within one to two business days via the options on our <a href="/contact-us">contact page</a>.</p>\n` +
      `<h3>Shipping</h3>\n` +
      `<p>Orders are processed within one to two business days. Delivery times depend on your location and the courier, and tracking details are shared as soon as your order ships.</p>\n` +
      `<h3>Returns and refunds</h3>\n` +
      `<p>If something is not right, contact us within seven days of delivery. Items returned unused and in their original packaging are eligible for an exchange or refund once inspected.</p>`,
  },
  {
    slug: "faqs",
    title: "FAQs",
    seo_title: `Frequently Asked Questions — ${STORE_NAME_TOKEN}`,
    seo_description: `Answers to common questions about shopping with ${STORE_NAME_TOKEN}.`,
    html:
      `<h2>Frequently Asked Questions</h2>\n` +
      `<h3>How do I place an order?</h3>\n` +
      `<p>Browse the store, add items to your cart and follow the checkout steps. You will receive a confirmation email once your order is placed.</p>\n` +
      `<h3>How can I track my order?</h3>\n` +
      `<p>As soon as your order ships we share the tracking details with you. You can also check the status of your orders from your account page.</p>\n` +
      `<h3>What payment methods do you accept?</h3>\n` +
      `<p>All payment options available to you are shown at checkout.</p>\n` +
      `<h3>Can I return an item?</h3>\n` +
      `<p>Yes — see our <a href="/support-policy">Support Policy</a> for the return window and conditions.</p>\n` +
      `<h3>How do I get in touch?</h3>\n` +
      `<p>Visit our <a href="/contact-us">contact page</a> — we aim to reply within one to two business days.</p>`,
  },
]

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
          seo_title: def.seo_title,
          seo_description: def.seo_description,
        })
      )
      await cmsService.createCmsSections({
        tenant_id: tenantId,
        page_id: page.id,
        type: "rich_text",
        label: def.title,
        rank: 0,
        enabled: true,
        data: { html: def.html, width: "narrow" },
      })
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
