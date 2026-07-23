/* ------------------------------------------------------------------ */
/* Build the theme data context.                                        */
/*                                                                     */
/* The developer guide promises a theme specific shapes: shop, routes,  */
/* cart, page.sections[], product, collection. THIS file is where our   */
/* real data is mapped to those shapes — it is the contract made        */
/* executable. If the guide says `product.featured_image`, this is      */
/* where a Medusa product's first image becomes exactly that.           */
/*                                                                     */
/* The rule the whole platform rests on: the MERCHANT owns the content  */
/* (the CMS sections, resolved commerce data), the THEME owns only how  */
/* it looks. So every value here is data, never markup.                 */
/* ------------------------------------------------------------------ */

import { buildDocumentSections } from "@modules/cms/render/document"

export type ThemeContext = Record<string, unknown>

type ShopInput = {
  name?: string
  domain?: string
  currency?: string
  locale?: string
  logo?: string | null
}

/** The globals every template gets, on every page. */
export function baseContext(opts: {
  shop: ShopInput
  template: string
  countryCode: string
  cart?: any
  customer?: any
  chrome?: any
  settings?: Record<string, unknown>
}): ThemeContext {
  const { shop, template, countryCode } = opts
  const cc = countryCode || "us"
  return {
    template,
    shop: {
      name: shop.name ?? "",
      domain: shop.domain ?? "",
      currency: (shop.currency ?? "USD").toUpperCase(),
      locale: shop.locale ?? "en",
      logo: shop.logo ?? null,
    },
    // Never let a theme hardcode a path — the country prefix and cart/account
    // routes come from here, so localisation and future URL changes are ours.
    routes: {
      root_url: `/${cc}`,
      cart_url: `/${cc}/cart`,
      search_url: `/${cc}/search`,
      account_url: `/${cc}/account`,
      collections_url: `/${cc}/store`,
    },
    request: { country_code: cc, locale: shop.locale ?? "en", path: `/${cc}` },
    cart: mapCart(opts.cart),
    customer: mapCustomer(opts.customer),
    chrome: opts.chrome ?? {},
    __theme_settings: opts.settings ?? {},
  }
}

/** The home page: the merchant's ordered CMS sections, resolved. */
export function homeContext(base: ThemeContext, sections: any[]): ThemeContext {
  return {
    ...base,
    page: {
      // Each section arrives as { id, type, settings } — the theme renders it
      // via sections/<type>.liquid. Commerce-bound sections (product_tabs,
      // category_showcase) are already resolved upstream, so a theme never
      // fetches anything. The per-section entry (settings flattening, style
      // scope, wrap_class / wrap_css) is built by the SHARED document
      // composer — the same code the editor canvas consumes — so the two
      // render paths can never disagree about a section's context shape.
      sections: buildDocumentSections(sections),
    },
  }
}

/** A product detail page. */
export function productContext(base: ThemeContext, product: any): ThemeContext {
  return { ...base, product: mapProduct(product) }
}

/** A collection / category page. */
export function collectionContext(
  base: ThemeContext,
  collection: any,
  products: any[]
): ThemeContext {
  return {
    ...base,
    collection: {
      title: collection?.title ?? collection?.name ?? "",
      handle: collection?.handle ?? "",
      description: collection?.description ?? "",
      image: collection?.image ?? collection?.thumbnail ?? null,
      products_count: products?.length ?? 0,
      products: (products ?? []).map(mapProduct),
    },
  }
}

/* --------------------------- mappers --------------------------- */

function mapProduct(p: any): any {
  if (!p) return null
  const images = (p.images ?? []).map((img: any) => ({
    url: img.url ?? img.src ?? "",
    alt: img.alt ?? p.title ?? "",
    variant_ids: (img.variants ?? []).map((v: any) => v.id),
  }))
  const variants = (p.variants ?? []).map((v: any) => ({
    id: v.id,
    title: v.title,
    sku: v.sku ?? null,
    available: v.inventory_quantity == null ? true : v.inventory_quantity > 0,
    price: priceOf(v),
    thumbnail: v.thumbnail ?? null,
    options: (v.options ?? []).map((o: any) => ({
      name: o.option?.title ?? o.name ?? "",
      value: o.value,
    })),
  }))
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    description: p.description ?? "",
    available: variants.some((v: any) => v.available),
    featured_image: images[0] ?? (p.thumbnail ? { url: p.thumbnail, alt: p.title } : null),
    images,
    price: p.price ?? (variants[0]?.price ?? 0),
    compare_at_price: p.compare_at_price ?? null,
    variants,
    options: (p.options ?? []).map((o: any) => ({
      name: o.title,
      values: (o.values ?? []).map((x: any) => x.value ?? x),
    })),
  }
}

/** Prices reach the storefront in MAJOR units; the `money` filter only formats. */
function priceOf(v: any): number {
  const cp = v?.calculated_price?.calculated_amount
  if (typeof cp === "number") return cp
  if (typeof v?.price === "number") return v.price
  return 0
}

function mapCart(cart: any): any {
  if (!cart) return { item_count: 0, total_price: 0, items: [] }
  const items = (cart.items ?? []).map((i: any) => ({
    id: i.id,
    title: i.title ?? i.product_title ?? "",
    quantity: i.quantity,
    line_price: i.total ?? i.unit_price * i.quantity,
    image: i.thumbnail ?? i.variant?.product?.thumbnail ?? null,
    variant: i.variant ? { id: i.variant.id, title: i.variant.title } : null,
    url: i.product_handle ? `/products/${i.product_handle}` : "#",
  }))
  return {
    item_count: items.reduce((n: number, i: any) => n + (i.quantity ?? 0), 0),
    total_price: cart.total ?? 0,
    subtotal_price: cart.subtotal ?? cart.item_subtotal ?? 0,
    items,
    checkout_url: `/checkout`,
  }
}

function mapCustomer(c: any): any {
  if (!c) return null
  return {
    id: c.id,
    first_name: c.first_name ?? "",
    email: c.email ?? "",
    orders_count: c.orders?.length ?? 0,
  }
}
