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

export function mapCart(cart: any): any {
  if (!cart) return { item_count: 0, total_price: 0, items: [] }
  const items = (cart.items ?? []).map((i: any) => ({
    id: i.id,
    title: i.title ?? i.product_title ?? "",
    product_title: i.product_title ?? i.title ?? "",
    quantity: i.quantity,
    unit_price: i.unit_price ?? 0,
    line_price: i.total ?? i.unit_price * i.quantity,
    original_line_price: i.original_total ?? null,
    image: i.thumbnail ?? i.variant?.product?.thumbnail ?? null,
    variant: i.variant
      ? { id: i.variant.id, title: i.variant.title, sku: i.variant.sku ?? null }
      : null,
    url: i.product_handle ? `/products/${i.product_handle}` : "#",
  }))
  return {
    item_count: items.reduce((n: number, i: any) => n + (i.quantity ?? 0), 0),
    total_price: cart.total ?? 0,
    subtotal_price: cart.subtotal ?? cart.item_subtotal ?? 0,
    discount_total: cart.discount_total ?? 0,
    shipping_total: cart.shipping_total ?? 0,
    tax_total: cart.tax_total ?? 0,
    currency: (cart.currency_code ?? "").toUpperCase() || null,
    promotions: (cart.promotions ?? [])
      .map((p: any) => ({
        code: p?.code ?? "",
        is_automatic: !!p?.is_automatic,
      }))
      .filter((p: any) => p.code || p.is_automatic),
    items,
    checkout_url: `/checkout`,
  }
}

export function mapCustomer(c: any): any {
  if (!c) return null
  return {
    id: c.id,
    first_name: c.first_name ?? "",
    last_name: c.last_name ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    orders_count: c.orders?.length ?? 0,
    addresses: (c.addresses ?? []).map(mapAddress),
  }
}

export function mapAddress(a: any): any {
  if (!a) return null
  return {
    id: a.id,
    first_name: a.first_name ?? "",
    last_name: a.last_name ?? "",
    company: a.company ?? "",
    address_1: a.address_1 ?? "",
    address_2: a.address_2 ?? "",
    city: a.city ?? "",
    province: a.province ?? "",
    postal_code: a.postal_code ?? "",
    country_code: (a.country_code ?? "").toUpperCase(),
    phone: a.phone ?? "",
    is_default_shipping: !!a.is_default_shipping,
    is_default_billing: !!a.is_default_billing,
  }
}

/** An order summary/detail for the account templates. Amounts are MAJOR units
 * like everywhere else in the contract — `money` only formats. */
export function mapOrder(o: any): any {
  if (!o) return null
  const items = (o.items ?? []).map((i: any) => ({
    id: i.id,
    title: i.title ?? i.product_title ?? "",
    variant_title: i.variant_title ?? i.variant?.title ?? "",
    quantity: i.quantity,
    unit_price: i.unit_price ?? 0,
    total: i.total ?? (i.unit_price ?? 0) * (i.quantity ?? 0),
    image: i.thumbnail ?? null,
  }))
  return {
    id: o.id,
    display_id: o.display_id ?? null,
    name: o.display_id != null ? `#${o.display_id}` : o.id,
    status: o.status ?? "",
    payment_status: o.payment_status ?? "",
    fulfillment_status: o.fulfillment_status ?? "",
    created_at: o.created_at ?? null,
    email: o.email ?? "",
    currency: (o.currency_code ?? "").toUpperCase() || null,
    subtotal: o.subtotal ?? o.item_subtotal ?? 0,
    discount_total: o.discount_total ?? 0,
    shipping_total: o.shipping_total ?? 0,
    tax_total: o.tax_total ?? 0,
    total: o.total ?? 0,
    item_count: items.reduce((n: number, i: any) => n + (i.quantity ?? 0), 0),
    items,
    shipping_address: mapAddress(o.shipping_address),
    billing_address: mapAddress(o.billing_address),
  }
}
