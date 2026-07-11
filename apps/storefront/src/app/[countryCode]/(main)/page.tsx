import { Metadata } from "next"

import { listProducts } from "@lib/data/products"
import { listCategories } from "@lib/data/categories"
import { getProductPrice } from "@lib/util/get-product-price"
import { getCmsPage } from "@lib/data/cms"

import SectionRenderer from "@modules/cms/section-renderer"
import { getActiveTheme } from "@themes/registry"
import HeroSlider from "@modules/home/components/learts/hero-slider"
import CategoryBanners from "@modules/home/components/learts/category-banners"
import ProductTabs from "@modules/home/components/learts/product-tabs"
import DealOfDay from "@modules/home/components/learts/deal-of-day"
import ShopCategories from "@modules/home/components/learts/shop-categories"
import Brands from "@modules/home/components/learts/brands"

export async function generateMetadata(): Promise<Metadata> {
  // Multi-tenant: title the home page after the tenant, not Forever Finds.
  if (
    process.env.MULTI_TENANT === "1" ||
    process.env.MULTI_TENANT === "true"
  ) {
    try {
      const { headers } = await import("next/headers")
      const name = (await headers()).get("x-tenant-name")
      if (name && name.trim()) {
        return {
          title: { absolute: name.trim() },
          description: `${name.trim()} — shop online.`,
        }
      }
    } catch {}
    return {}
  }
  return {
    title: "Forever Finds – Handmade & Gifts Shop",
    description:
      "Forever Finds is an online shop for handicrafts, gifts and arts' works.",
  }
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params

  const [{ response }, categories, cmsPage, activeTheme] = await Promise.all([
    listProducts({
      countryCode,
      queryParams: {
        limit: 12,
        fields:
          "*variants.calculated_price,*images,thumbnail,handle,title,*categories",
      } as any,
    }).catch(() => ({ response: { products: [], count: 0 } })),
    listCategories().catch(() => []),
    // Live published "home" snapshot (null when none exists -> hardcoded fallback).
    getCmsPage("home").catch(() => null),
    // Active storefront theme (selects which block renderers + body class).
    getActiveTheme(),
  ])

  const products = response.products

  const saleItems = products.filter((p) => {
    const { cheapestPrice } = getProductPrice({ product: p })
    return (
      cheapestPrice?.price_type === "sale" ||
      (!!cheapestPrice &&
        cheapestPrice.original_price !== cheapestPrice.calculated_price)
    )
  })

  const bestSellers = [...products].reverse()

  // When a published "home" snapshot exists, render ALL of its CMS sections
  // (hero_slider + promo_banner_grid + product_tabs + deal_of_day +
  // category_showcase + brand_strip) via the SectionRenderer. When no snapshot
  // exists, fall back to the full hardcoded home unchanged (no regression).
  const hasCmsHome =
    !!cmsPage && Array.isArray(cmsPage.sections) && cmsPage.sections.length > 0

  return (
    <div className={activeTheme.bodyClassName ?? "learts-theme"}>
      {hasCmsHome ? (
        <SectionRenderer
          sections={cmsPage!.sections}
          countryCode={countryCode}
          blocks={activeTheme.blocks}
        />
      ) : activeTheme.defaultSections?.length ? (
        // No published CMS home yet: render the active theme's own default
        // sections (fresh tenants / new stores) instead of the Learts-only
        // hardcoded fallback below.
        <SectionRenderer
          sections={activeTheme.defaultSections as any}
          countryCode={countryCode}
          blocks={activeTheme.blocks}
        />
      ) : (
        <>
          <HeroSlider />
          <CategoryBanners />
          <ProductTabs
            newArrivals={products}
            saleItems={saleItems}
            bestSellers={bestSellers}
          />
          <DealOfDay />
          <ShopCategories categories={categories ?? []} />
          <Brands />
        </>
      )}
    </div>
  )
}
