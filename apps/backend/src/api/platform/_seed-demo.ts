/**
 * _seed-demo.ts — best-effort demo-content seeding for a freshly-provisioned
 * tenant instance, driven entirely through the tenant's own ADMIN REST API
 * (base URL + an authenticated header set), so it plugs into the existing
 * `finishDedicatedInstance` provisioning step WITHOUT touching the CLI /
 * `medusa exec` path (which can wipe the instance's .medusa/server/.env).
 *
 * It runs AFTER the instance is booted and the USD region / default currency /
 * sales channel already exist (created earlier in finishDedicatedInstance), and
 * seeds three things so a new store is never empty:
 *
 *   1. ~4 neutral product categories (Featured / New Arrivals / Accessories /
 *      Sale) — generic enough to fit any tenant.
 *   2. ~8 neutral demo products (Classic Tee, Ceramic Mug, ...) — each published,
 *      one "Size: One Size" option + one variant, USD price, linked to the
 *      default sales channel, assigned to 1-2 categories. Variants use
 *      manage_inventory:false so they are always purchasable and NO
 *      inventory-level calls are needed.
 *   3. Three starter CMS pages (about / faq / contact) built from generic block
 *      types (rich_text + image_with_text) and PUBLISHED (en) so they render live
 *      and show up in the visual-editor page switcher.
 *
 * EVERYTHING is best-effort + idempotent: every phase (and each page) is wrapped
 * in its own try/catch, logs a warning and continues; a failure never aborts the
 * rest of the seed or the surrounding provisioning. Re-running does not duplicate
 * (categories skip existing names, products skip entirely if any product exists,
 * pages skip an existing slug).
 */

/** Pooled-storefront demo images, served for every tenant. */
const PRODUCT_IMAGE = (n: number) => `/shofy/img/product/product-${n}.jpg`

type Cat = { name: string; is_active: boolean }

const DEMO_CATEGORIES: Cat[] = [
  { name: "Featured", is_active: true },
  { name: "New Arrivals", is_active: true },
  { name: "Accessories", is_active: true },
  { name: "Sale", is_active: true },
]

type DemoProduct = {
  title: string
  handle: string
  description: string
  image: number
  categories: string[]
  sku: string
  amount: number
}

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    title: "Classic Tee",
    handle: "classic-tee",
    description:
      "A soft, everyday cotton t-shirt with a relaxed fit — an easy staple for any wardrobe.",
    image: 1,
    categories: ["Featured", "New Arrivals"],
    sku: "DEMO-1",
    amount: 19,
  },
  {
    title: "Ceramic Mug",
    handle: "ceramic-mug",
    description:
      "A sturdy hand-glazed ceramic mug that keeps your coffee or tea warm, cup after cup.",
    image: 2,
    categories: ["Accessories"],
    sku: "DEMO-2",
    amount: 15,
  },
  {
    title: "Canvas Tote",
    handle: "canvas-tote",
    description:
      "A durable heavy-canvas tote for groceries, books, or a day at the market.",
    image: 3,
    categories: ["Accessories", "New Arrivals"],
    sku: "DEMO-3",
    amount: 25,
  },
  {
    title: "Notebook",
    handle: "notebook",
    description:
      "A lay-flat notebook with thick, bleed-resistant pages for notes, sketches, and lists.",
    image: 4,
    categories: ["Featured"],
    sku: "DEMO-4",
    amount: 12,
  },
  {
    title: "Water Bottle",
    handle: "water-bottle",
    description:
      "An insulated stainless-steel bottle that keeps drinks cold for hours on the go.",
    image: 5,
    categories: ["New Arrivals"],
    sku: "DEMO-5",
    amount: 22,
  },
  {
    title: "Wall Art Print",
    handle: "wall-art-print",
    description:
      "A gallery-quality art print to add warmth and character to any room.",
    image: 6,
    categories: ["Featured", "Sale"],
    sku: "DEMO-6",
    amount: 39,
  },
  {
    title: "Scented Candle",
    handle: "scented-candle",
    description:
      "A long-burning soy candle with a warm, subtle fragrance for a cozy space.",
    image: 7,
    categories: ["Accessories"],
    sku: "DEMO-7",
    amount: 18,
  },
  {
    title: "Desk Lamp",
    handle: "desk-lamp",
    description:
      "An adjustable LED desk lamp with a clean, modern silhouette for focused work.",
    image: 8,
    categories: ["Sale"],
    sku: "DEMO-8",
    amount: 49,
  },
]

/** Small JSON fetch wrapper. Returns parsed body or null (never throws). */
async function api(
  base: string,
  path: string,
  H: Record<string, string>,
  init?: { method?: string; body?: unknown }
): Promise<any> {
  return fetch(`${base}${path}`, {
    method: init?.method ?? "GET",
    headers: H,
    body: init?.body != null ? JSON.stringify(init.body) : undefined,
  })
    .then((r) => r.json())
    .catch(() => null)
}

type Logger = { info: (m: string) => void; warn: (m: string) => void }

/** A no-op-safe console logger (kept internal so the caller stays simple). */
const log: Logger = {
  info: (m) => console.log(`[seed-demo] ${m}`),
  warn: (m) => console.warn(`[seed-demo] ${m}`),
}

/**
 * seedDemoContent — populate a tenant instance with demo categories, products and
 * starter CMS pages via its admin REST API. Best-effort: never throws.
 *
 * @param base  the instance base URL (no trailing slash), e.g. https://acme.mautomate.ai
 * @param H     authenticated admin headers ({ authorization: "Bearer <token>", "content-type": "application/json" })
 */
export async function seedDemoContent(
  base: string,
  H: Record<string, string>
): Promise<void> {
  base = base.replace(/\/$/, "")

  // Resolve the default sales channel (created during provisioning).
  let salesChannelId: string | undefined
  try {
    const sc = await api(base, "/admin/sales-channels?limit=1", H)
    salesChannelId = sc?.sales_channels?.[0]?.id
  } catch (e) {
    log.warn(`could not resolve sales channel: ${(e as Error)?.message ?? e}`)
  }

  // Resolve the default shipping profile (created by a core migration). v2
  // product-create requires a shipping_profile_id (see initial-data-seed.ts).
  let shippingProfileId: string | undefined
  try {
    const sp = await api(base, "/admin/shipping-profiles?limit=1", H)
    shippingProfileId = sp?.shipping_profiles?.[0]?.id
  } catch (e) {
    log.warn(
      `could not resolve shipping profile: ${(e as Error)?.message ?? e}`
    )
  }

  /* ---------------------------------------------------------------- */
  /* 1. Categories (idempotent by name).                              */
  /* ---------------------------------------------------------------- */
  const categoryIdByName: Record<string, string> = {}
  try {
    const existing = await api(
      base,
      "/admin/product-categories?limit=100",
      H
    )
    const existingByName: Record<string, string> = {}
    for (const c of existing?.product_categories ?? []) {
      if (c?.name) {
        existingByName[c.name] = c.id
      }
    }

    for (const cat of DEMO_CATEGORIES) {
      if (existingByName[cat.name]) {
        categoryIdByName[cat.name] = existingByName[cat.name]
        continue
      }
      const created = await api(base, "/admin/product-categories", H, {
        method: "POST",
        body: { name: cat.name, is_active: cat.is_active },
      })
      const id = created?.product_category?.id
      if (id) {
        categoryIdByName[cat.name] = id
        log.info(`created category "${cat.name}"`)
      } else {
        log.warn(`category "${cat.name}" create returned no id`)
      }
    }
  } catch (e) {
    log.warn(`categories phase failed: ${(e as Error)?.message ?? e}`)
  }

  /* ---------------------------------------------------------------- */
  /* 2. Products (skip the WHOLE phase if any product already exists). */
  /* ---------------------------------------------------------------- */
  try {
    const existing = await api(base, "/admin/products?limit=1", H)
    const count = existing?.count ?? existing?.products?.length ?? 0
    if (count > 0) {
      log.info(`products already present (${count}) — skipping product seed`)
    } else {
      for (const p of DEMO_PRODUCTS) {
        try {
          const category_ids = p.categories
            .map((n) => categoryIdByName[n])
            .filter((id): id is string => Boolean(id))

          const body: Record<string, unknown> = {
            title: p.title,
            handle: p.handle,
            description: p.description,
            status: "published",
            thumbnail: PRODUCT_IMAGE(p.image),
            images: [{ url: PRODUCT_IMAGE(p.image) }],
            // The admin REST API links categories via `categories: [{ id }]`
            // (NOT the workflow's `category_ids`, which it rejects as unknown).
            categories: category_ids.map((id) => ({ id })),
            options: [{ title: "Size", values: ["One Size"] }],
            variants: [
              {
                title: "One Size",
                sku: p.sku,
                manage_inventory: false,
                options: { Size: "One Size" },
                prices: [{ currency_code: "usd", amount: p.amount }],
              },
            ],
          }
          if (salesChannelId) {
            body.sales_channels = [{ id: salesChannelId }]
          }
          if (shippingProfileId) {
            body.shipping_profile_id = shippingProfileId
          }

          const created = await api(base, "/admin/products", H, {
            method: "POST",
            body,
          })
          if (created?.product?.id) {
            log.info(`created product "${p.title}"`)
          } else {
            log.warn(
              `product "${p.title}" create returned no id: ${JSON.stringify(
                created
              )?.slice(0, 300)}`
            )
          }
        } catch (e) {
          log.warn(
            `product "${p.title}" failed: ${(e as Error)?.message ?? e}`
          )
        }
      }
    }
  } catch (e) {
    log.warn(`products phase failed: ${(e as Error)?.message ?? e}`)
  }

  /* ---------------------------------------------------------------- */
  /* 3. CMS starter pages (about / faq / contact) — create + publish. */
  /* ---------------------------------------------------------------- */
  await seedCmsPages(base, H)
}

/** rich_text block data (see modules/cms/registry/rich-text.ts). */
const richText = (html: string) => ({
  type: "rich_text",
  data: { html, width: "normal" as const },
})

/** image_with_text block data (see modules/cms/registry/image-with-text.ts). */
const imageWithText = (data: {
  image: string
  title: string
  body: string
  eyebrow?: string
  href?: string
  label?: string
}) => ({
  type: "image_with_text",
  data: {
    image: data.image,
    image_side: "left" as const,
    eyebrow: data.eyebrow ?? "Our shop",
    title: data.title,
    body: data.body,
    cta: { label: data.label ?? "Shop now", href: data.href ?? "/store" },
  },
})

type StarterPage = {
  slug: string
  title: string
  sections: { type: string; data: Record<string, unknown> }[]
}

const STARTER_PAGES: StarterPage[] = [
  {
    slug: "about",
    title: "About Us",
    sections: [
      richText(
        "<h2>About Us</h2>\n" +
          "<p>Welcome to our store. We are a small team passionate about bringing you " +
          "carefully chosen products, honest prices, and friendly service. Every item " +
          "in our catalog is picked with the same care we would want as customers " +
          "ourselves.</p>\n" +
          '<p>Have a question? <a href="/contact">Get in touch</a> — we would love to ' +
          "hear from you.</p>"
      ),
      imageWithText({
        image: PRODUCT_IMAGE(1),
        eyebrow: "Our story",
        title: "Made to be found,\nbuilt to last",
        body:
          "We believe good products should be simple to love — well made, fairly " +
          "priced, and ready to become part of your everyday life.",
        href: "/store",
        label: "Browse the shop",
      }),
    ],
  },
  {
    slug: "faq",
    title: "FAQ",
    sections: [
      richText(
        "<h2>Frequently Asked Questions</h2>\n" +
          "<h3>How long does shipping take?</h3>\n" +
          "<p>Most orders ship within 1-2 business days and arrive within a week, " +
          "depending on your location.</p>\n" +
          "<h3>What is your return policy?</h3>\n" +
          "<p>You can return unused items in their original condition within 30 days " +
          "of delivery for a full refund.</p>\n" +
          "<h3>How can I track my order?</h3>\n" +
          "<p>Once your order ships, we email you a tracking link so you can follow it " +
          "every step of the way.</p>\n" +
          "<h3>How do I contact support?</h3>\n" +
          '<p>Visit our <a href="/contact">contact page</a> and we will get back to ' +
          "you as soon as possible.</p>"
      ),
    ],
  },
  {
    slug: "contact",
    title: "Contact",
    sections: [
      richText(
        "<h2>Contact Us</h2>\n" +
          "<p>We would love to hear from you. Reach out with any questions about " +
          "products, orders, or anything else.</p>\n" +
          "<p><strong>Email:</strong> support@example.com<br/>\n" +
          "<strong>Phone:</strong> +1 (555) 010-0100<br/>\n" +
          "<strong>Hours:</strong> Monday to Friday, 9am - 5pm</p>\n" +
          "<p>Prefer to write? Our team typically replies within one business day.</p>"
      ),
    ],
  },
]

/**
 * Create + populate + publish the starter CMS pages. Idempotent: an existing slug
 * is skipped. Each page is best-effort and isolated (one failure never blocks the
 * others). Publish is best-effort — a page whose publish fails is still created as
 * a draft the owner can publish from the admin.
 */
async function seedCmsPages(
  base: string,
  H: Record<string, string>
): Promise<void> {
  let existingSlugs = new Set<string>()
  try {
    const list = await api(base, "/admin/cms/pages?limit=200", H)
    for (const pg of list?.pages ?? []) {
      if (pg?.slug) {
        existingSlugs.add(pg.slug)
      }
    }
  } catch (e) {
    log.warn(`could not list CMS pages: ${(e as Error)?.message ?? e}`)
  }

  for (const page of STARTER_PAGES) {
    try {
      if (existingSlugs.has(page.slug)) {
        log.info(`CMS page "${page.slug}" already exists — skipping`)
        continue
      }

      const created = await api(base, "/admin/cms/pages", H, {
        method: "POST",
        body: { title: page.title, slug: page.slug, status: "active" },
      })
      const pageId = created?.page?.id
      if (!pageId) {
        log.warn(
          `CMS page "${page.slug}" create returned no id: ${JSON.stringify(
            created
          )?.slice(0, 200)}`
        )
        continue
      }

      for (const section of page.sections) {
        await api(base, `/admin/cms/pages/${pageId}/sections`, H, {
          method: "POST",
          body: { type: section.type, data: section.data, enabled: true },
        })
      }

      // Publish the en snapshot so the page renders live immediately.
      await api(base, `/admin/cms/pages/${pageId}/publish?locale=en`, H, {
        method: "POST",
        body: { locale: "en", note: "Seeded starter page (en)" },
      })

      log.info(`created + published CMS page "${page.slug}"`)
    } catch (e) {
      log.warn(
        `CMS page "${page.slug}" failed: ${(e as Error)?.message ?? e}`
      )
    }
  }
}

export default seedDemoContent
