import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { CMS_MODULE } from "../modules/cms"
import { PLATFORM_MODULE } from "../modules/platform"
import type CmsModuleService from "../modules/cms/service"
import { publishPageSnapshot } from "../modules/cms/publish-helper"
import {
  STARTER_PAGES,
  STORE_NAME_TOKEN,
  interpolateStoreName,
  renderStarterSections,
} from "../modules/cms/starter-pages"

/**
 * One-off migration: redesign the five shared static pages (about-us,
 * store-location, contact-us, support-policy, faqs) from the OLD single bare
 * `rich_text` boilerplate into the new multi-section layouts, for EVERY tenant.
 *
 * Run with:
 *   export NODE_PATH=/home/ratul/foreverfinds/node_modules
 *   export PATH=/home/ratul/foreverfinds/node_modules/.bin:$PATH
 *   medusa exec ./src/scripts/reseed-static-pages.ts
 *
 * SAFETY / NON-DESTRUCTIVE:
 *   - A page is reseeded ONLY when it STILL holds exactly the untouched old
 *     default: a single `rich_text` section whose html byte-matches the shipped
 *     boilerplate (token literal) AND has no per-locale translations. Any page a
 *     merchant has customised (edited copy, extra/removed sections, added a
 *     translation) is left completely alone.
 *   - The store's real name is BAKED into the new copy (read-time {{store_name}}
 *     interpolation is not wired up for page snapshots).
 *   - Writes are tenant-scoped (tenant_id on every row; publish ownership-guarded).
 *   - IDEMPOTENT: a page already carrying the new layout is detected and skipped
 *     with no writes, so the script is safe to re-run.
 */

/** The EXACT html of each OLD single-`rich_text` starter page (token literal). */
const OLD_STARTER_HTML: Record<string, string> = {
  "about-us":
    `<h2>About ${STORE_NAME_TOKEN}</h2>\n` +
    `<p>Welcome to ${STORE_NAME_TOKEN}. We are an independent online store dedicated to bringing you quality products at fair prices, backed by friendly and responsive customer service.</p>\n` +
    `<p>Every order is picked and packed with care, and we work with trusted delivery partners so your purchase reaches you safely and on time.</p>\n` +
    `<p>Have a question? <a href="/contact-us">Get in touch</a> — we would love to hear from you.</p>`,
  "store-location":
    `<h2>Store location</h2>\n` +
    `<p>${STORE_NAME_TOKEN} is an online-first store — you can shop with us from anywhere, at any time.</p>\n` +
    `<p>Our full address and pickup information will be published on this page soon. Until then, please reach out through our <a href="/contact-us">contact page</a> and we will gladly help with pickup, delivery or any other questions.</p>`,
  "contact-us":
    `<h2>Contact ${STORE_NAME_TOKEN}</h2>\n` +
    `<p>We would love to hear from you. Whether you have a question about a product, an existing order, shipping or returns, our team is happy to help.</p>\n` +
    `<ul>\n` +
    `<li>Send us a message using the email address shown in the site footer.</li>\n` +
    `<li>Reply to any order confirmation email — it reaches our support team directly.</li>\n` +
    `<li>Reach out on our social channels linked in the footer.</li>\n` +
    `</ul>\n` +
    `<p>We aim to answer every message within one to two business days.</p>`,
  "support-policy":
    `<h2>Support Policy</h2>\n` +
    `<p>${STORE_NAME_TOKEN} wants every purchase to be a great experience. This page summarises how we handle support, shipping and returns.</p>\n` +
    `<h3>Customer support</h3>\n` +
    `<p>Our team responds to questions within one to two business days via the options on our <a href="/contact-us">contact page</a>.</p>\n` +
    `<h3>Shipping</h3>\n` +
    `<p>Orders are processed within one to two business days. Delivery times depend on your location and the courier, and tracking details are shared as soon as your order ships.</p>\n` +
    `<h3>Returns and refunds</h3>\n` +
    `<p>If something is not right, contact us within seven days of delivery. Items returned unused and in their original packaging are eligible for an exchange or refund once inspected.</p>`,
  faqs:
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
}

const SEED_ACTOR_ID = "platform"

/** Deterministic, key-sorted JSON so jsonb key reordering doesn't defeat compares. */
function stableStringify(value: unknown): string {
  const seen = new WeakSet()
  const norm = (v: any): any => {
    if (v && typeof v === "object") {
      if (seen.has(v)) return null
      seen.add(v)
      if (Array.isArray(v)) return v.map(norm)
      const out: Record<string, unknown> = {}
      for (const k of Object.keys(v).sort()) out[k] = norm(v[k])
      return out
    }
    return v
  }
  return JSON.stringify(norm(value))
}

type SectionRow = {
  id: string
  type: string
  rank?: number
  data?: any
  translations?: { id: string }[]
}

/** Sections sorted by rank ascending (stable). */
function byRank(rows: SectionRow[]): SectionRow[] {
  return [...rows].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
}

/** True when the page still holds exactly the untouched old boilerplate. */
function isUntouchedOldDefault(slug: string, sections: SectionRow[]): boolean {
  if (sections.length !== 1) return false
  const s = sections[0]
  if (s.type !== "rich_text") return false
  if ((s.translations?.length ?? 0) > 0) return false
  const oldHtml = OLD_STARTER_HTML[slug]
  return typeof s.data?.html === "string" && s.data.html === oldHtml
}

/** True when the page already carries the exact NEW layout (for this store name). */
function isAlreadyNewLayout(
  slug: string,
  storeName: string,
  sections: SectionRow[]
): boolean {
  const expected = renderStarterSections(slug, storeName)
  if (sections.length !== expected.length) return false
  for (let i = 0; i < expected.length; i++) {
    if (sections[i].type !== expected[i].type) return false
    if (stableStringify(sections[i].data) !== stableStringify(expected[i].data)) {
      return false
    }
  }
  return true
}

export default async function reseedStaticPages({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const cmsService = container.resolve<CmsModuleService>(CMS_MODULE)
  const platform: any = container.resolve(PLATFORM_MODULE)

  const tenants = await platform.listTenants({}, { take: 1000 })
  logger.info(
    `[reseed-static] scanning ${tenants?.length ?? 0} tenant(s) for the 5 static pages...`
  )

  const totals = { updated: 0, alreadyNew: 0, customized: 0, missing: 0, failed: 0 }

  for (const tenant of tenants ?? []) {
    const tenantId: string = tenant.id
    const storeName: string = (tenant.name ?? "").trim()
    const perTenant: { updated: string[]; skipped: string[] } = {
      updated: [],
      skipped: [],
    }

    for (const def of STARTER_PAGES) {
      const slug = def.slug
      try {
        const pages = await cmsService.listCmsPages({
          tenant_id: tenantId,
          slug,
        })
        const page: any = pages?.[0] ?? null
        if (!page) {
          totals.missing++
          perTenant.skipped.push(`${slug} (missing)`)
          continue
        }

        const sections = byRank(
          (await cmsService.listCmsSections(
            { tenant_id: tenantId, page_id: page.id },
            { relations: ["translations"] }
          )) as SectionRow[]
        )

        if (isUntouchedOldDefault(slug, sections)) {
          // Replace the lone boilerplate section with the new multi-section
          // layout, then re-publish the en snapshot.
          const translationIds = sections
            .flatMap((s) => s.translations ?? [])
            .map((t) => t.id)
          if (translationIds.length) {
            await cmsService.softDeleteCmsSectionTranslations(translationIds)
          }
          await cmsService.softDeleteCmsSections(sections.map((s) => s.id))

          for (const section of renderStarterSections(slug, storeName)) {
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

          // Bake the store name into SEO too (it also carried the literal token).
          await cmsService.updateCmsPages({
            id: page.id,
            seo_title: interpolateStoreName(def.seo_title, storeName),
            seo_description: interpolateStoreName(def.seo_description, storeName),
          })

          const published = await publishPageSnapshot(container, {
            pageId: page.id,
            tenant_id: tenantId,
            locale: "en",
            published_by: SEED_ACTOR_ID,
            note: "reseed static page (multi-section redesign)",
          })
          if (!published.ok) {
            throw new Error(
              `publish failed: ${published.errors.join("; ")}`
            )
          }

          totals.updated++
          perTenant.updated.push(slug)
        } else if (isAlreadyNewLayout(slug, storeName, sections)) {
          totals.alreadyNew++
          perTenant.skipped.push(`${slug} (already-redesigned)`)
        } else {
          totals.customized++
          perTenant.skipped.push(`${slug} (customized)`)
        }
      } catch (e) {
        totals.failed++
        perTenant.skipped.push(`${slug} (FAILED: ${(e as Error).message})`)
        logger.error(
          `[reseed-static] ${tenant.slug ?? tenantId} / ${slug} FAILED: ${
            (e as Error).message
          }`
        )
      }
    }

    logger.info(
      `[reseed-static] ${tenant.slug ?? tenantId} — updated: [${perTenant.updated.join(
        ", "
      )}] | skipped: [${perTenant.skipped.join(", ")}]`
    )
  }

  logger.info(
    `[reseed-static] DONE. pages updated: ${totals.updated}, already-redesigned: ${totals.alreadyNew}, customized(skipped): ${totals.customized}, missing: ${totals.missing}, failed: ${totals.failed}`
  )
}
