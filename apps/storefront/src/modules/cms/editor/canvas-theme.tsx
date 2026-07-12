"use client"

/* ------------------------------------------------------------------ */
/* Editor canvas — CLIENT-safe theme registry                          */
/*                                                                     */
/* The visual-editor canvas is a "use client" component, so it CANNOT   */
/* import @themes/registry: that pulls every theme's async server       */
/* Footer + data-fetching blocks (product_tabs / category_showcase),    */
/* which transitively import server-only modules (@lib/data/cms,        */
/* cookies) and would break the client build.                          */
/*                                                                     */
/* This registry gives the canvas the ACTIVE theme's LOOK using only    */
/* client-safe pieces: each theme's client Header, its body className,  */
/* and its client-renderable block renderers. The two async server      */
/* blocks are replaced with the theme-neutral Canvas* live previews     */
/* (same substitution the canvas has always used), so the editor shows  */
/* real products/categories without importing server-only code.        */
/*                                                                     */
/* The active theme id comes from /api/puck/chrome (resolved server-    */
/* side with the same priority as the live storefront). Keyed lookup    */
/* here selects the matching chrome + blocks; unknown ids fall back to  */
/* Learts, exactly like getThemeById on the server.                    */
/* ------------------------------------------------------------------ */

import type { ComponentType } from "react"

/* Shared / Learts client block renderers (the originals live in
   modules/cms/blocks and are what the Learts theme uses). */
import LeartsHeader from "@modules/layout/components/learts-header"
import HeroSlider from "@modules/cms/blocks/HeroSlider"
import PromoBannerGrid from "@modules/cms/blocks/PromoBannerGrid"
import DealOfDay from "@modules/cms/blocks/DealOfDay"
import BrandStrip from "@modules/cms/blocks/BrandStrip"
import RichText from "@modules/cms/blocks/RichText"
import ImageWithText from "@modules/cms/blocks/ImageWithText"
import Newsletter from "@modules/cms/blocks/Newsletter"
import InstagramGrid from "@modules/cms/blocks/InstagramGrid"
import Testimonials from "@modules/cms/blocks/Testimonials"
import Container from "@modules/cms/blocks/Container"
import ImageGallery from "@modules/cms/blocks/ImageGallery"

/* Theme-neutral CLIENT previews for the two ASYNC server blocks. */
import CanvasProductTabs from "./CanvasProductTabs"
import CanvasCategoryShowcase from "./CanvasCategoryShowcase"

/* Footer: Learts uses the shared neutral CanvasFooter; every other theme uses
   its OWN client-safe FooterView (the presentational half of its async server
   footer), fed the chrome data the canvas already has. */
import CanvasFooter from "./CanvasFooter"
import AuroraFooterView from "@themes/aurora/chrome/AuroraFooterView"
import CignetFooterView from "@themes/cignet/chrome/CignetFooterView"
import ShofyFooterView from "@themes/shofy/chrome/ShofyFooterView"
import EkkaFooterView from "@themes/ekka/chrome/EkkaFooterView"
import HelendoFooterView from "@themes/helendo/chrome/HelendoFooterView"
import BazaroFooterView from "@themes/bazaro/chrome/BazaroFooterView"
import ExzoFooterView from "@themes/exzo/chrome/ExzoFooterView"
import RokonFooterView from "@themes/rokon/chrome/RokonFooterView"

/* Bespoke theme headers (all "use client"; drop-in for LeartsHeader). */
import AuroraHeader from "@themes/aurora/chrome/AuroraHeader"
import CignetHeader from "@themes/cignet/chrome/CignetHeader"
import ShofyHeader from "@themes/shofy/chrome/ShofyHeader"
import EkkaHeader from "@themes/ekka/chrome/EkkaHeader"
import HelendoHeader from "@themes/helendo/chrome/HelendoHeader"
import BazaroHeader from "@themes/bazaro/chrome/BazaroHeader"
import ExzoHeader from "@themes/exzo/chrome/ExzoHeader"
import RokonHeader from "@themes/rokon/chrome/RokonHeader"

/* Per-theme client-safe block renderers (the 9 non-async blocks; the two
   async ones use the Canvas* previews above). Imported directly from each
   theme's block files — NOT via the theme's blocks.ts map, which also imports
   the async product_tabs / category_showcase renderers. */
import AuroraHeroSlider from "@themes/aurora/blocks/HeroSlider"
import AuroraPromoBannerGrid from "@themes/aurora/blocks/PromoBannerGrid"
import AuroraDealOfDay from "@themes/aurora/blocks/DealOfDay"
import AuroraBrandStrip from "@themes/aurora/blocks/BrandStrip"
import AuroraRichText from "@themes/aurora/blocks/RichText"
import AuroraImageWithText from "@themes/aurora/blocks/ImageWithText"
import AuroraNewsletter from "@themes/aurora/blocks/Newsletter"
import AuroraInstagramGrid from "@themes/aurora/blocks/InstagramGrid"
import AuroraTestimonials from "@themes/aurora/blocks/Testimonials"

import CignetHeroSlider from "@themes/cignet/blocks/HeroSlider"
import CignetPromoBannerGrid from "@themes/cignet/blocks/PromoBannerGrid"
import CignetDealOfDay from "@themes/cignet/blocks/DealOfDay"
import CignetBrandStrip from "@themes/cignet/blocks/BrandStrip"
import CignetRichText from "@themes/cignet/blocks/RichText"
import CignetImageWithText from "@themes/cignet/blocks/ImageWithText"
import CignetNewsletter from "@themes/cignet/blocks/Newsletter"
import CignetInstagramGrid from "@themes/cignet/blocks/InstagramGrid"
import CignetTestimonials from "@themes/cignet/blocks/Testimonials"

import ShofyHeroSlider from "@themes/shofy/blocks/HeroSlider"
import ShofyPromoBannerGrid from "@themes/shofy/blocks/PromoBannerGrid"
import ShofyDealOfDay from "@themes/shofy/blocks/DealOfDay"
import ShofyBrandStrip from "@themes/shofy/blocks/BrandStrip"
import ShofyRichText from "@themes/shofy/blocks/RichText"
import ShofyImageWithText from "@themes/shofy/blocks/ImageWithText"
import ShofyNewsletter from "@themes/shofy/blocks/Newsletter"
import ShofyInstagramGrid from "@themes/shofy/blocks/InstagramGrid"
import ShofyTestimonials from "@themes/shofy/blocks/Testimonials"

import EkkaHeroSlider from "@themes/ekka/blocks/HeroSlider"
import EkkaPromoBannerGrid from "@themes/ekka/blocks/PromoBannerGrid"
import EkkaDealOfDay from "@themes/ekka/blocks/DealOfDay"
import EkkaBrandStrip from "@themes/ekka/blocks/BrandStrip"
import EkkaRichText from "@themes/ekka/blocks/RichText"
import EkkaImageWithText from "@themes/ekka/blocks/ImageWithText"
import EkkaNewsletter from "@themes/ekka/blocks/Newsletter"
import EkkaInstagramGrid from "@themes/ekka/blocks/InstagramGrid"
import EkkaTestimonials from "@themes/ekka/blocks/Testimonials"

import HelendoHeroSlider from "@themes/helendo/blocks/HeroSlider"
import HelendoPromoBannerGrid from "@themes/helendo/blocks/PromoBannerGrid"
import HelendoDealOfDay from "@themes/helendo/blocks/DealOfDay"
import HelendoBrandStrip from "@themes/helendo/blocks/BrandStrip"
import HelendoRichText from "@themes/helendo/blocks/RichText"
import HelendoImageWithText from "@themes/helendo/blocks/ImageWithText"
import HelendoNewsletter from "@themes/helendo/blocks/Newsletter"
import HelendoInstagramGrid from "@themes/helendo/blocks/InstagramGrid"
import HelendoTestimonials from "@themes/helendo/blocks/Testimonials"

import BazaroHeroSlider from "@themes/bazaro/blocks/HeroSlider"
import BazaroPromoBannerGrid from "@themes/bazaro/blocks/PromoBannerGrid"
import BazaroDealOfDay from "@themes/bazaro/blocks/DealOfDay"
import BazaroBrandStrip from "@themes/bazaro/blocks/BrandStrip"
import BazaroRichText from "@themes/bazaro/blocks/RichText"
import BazaroImageWithText from "@themes/bazaro/blocks/ImageWithText"
import BazaroNewsletter from "@themes/bazaro/blocks/Newsletter"
import BazaroInstagramGrid from "@themes/bazaro/blocks/InstagramGrid"
import BazaroTestimonials from "@themes/bazaro/blocks/Testimonials"

import ExzoHeroSlider from "@themes/exzo/blocks/HeroSlider"
import ExzoPromoBannerGrid from "@themes/exzo/blocks/PromoBannerGrid"
import ExzoDealOfDay from "@themes/exzo/blocks/DealOfDay"
import ExzoBrandStrip from "@themes/exzo/blocks/BrandStrip"
import ExzoRichText from "@themes/exzo/blocks/RichText"
import ExzoImageWithText from "@themes/exzo/blocks/ImageWithText"
import ExzoNewsletter from "@themes/exzo/blocks/Newsletter"
import ExzoInstagramGrid from "@themes/exzo/blocks/InstagramGrid"
import ExzoTestimonials from "@themes/exzo/blocks/Testimonials"

import RokonHeroSlider from "@themes/rokon/blocks/HeroSlider"
import RokonPromoBannerGrid from "@themes/rokon/blocks/PromoBannerGrid"
import RokonDealOfDay from "@themes/rokon/blocks/DealOfDay"
import RokonBrandStrip from "@themes/rokon/blocks/BrandStrip"
import RokonRichText from "@themes/rokon/blocks/RichText"
import RokonImageWithText from "@themes/rokon/blocks/ImageWithText"
import RokonNewsletter from "@themes/rokon/blocks/Newsletter"
import RokonInstagramGrid from "@themes/rokon/blocks/InstagramGrid"
import RokonTestimonials from "@themes/rokon/blocks/Testimonials"

/** The canvas-renderable pieces of a theme. */
export interface CanvasTheme {
  /** The theme's client Header (drop-in for LeartsHeader). */
  Header: ComponentType<any>
  /** The theme's client-safe Footer view (drop-in for CanvasFooter). Fed the
      resolved footer settings + categories + brand the canvas already has. */
  Footer: ComponentType<any>
  /** The `<body>` wrapper className the live storefront uses. */
  bodyClassName: string
  /** block_type -> client-safe renderer (async blocks use Canvas* previews). */
  blocks: Record<string, ComponentType<any>>
}

/** The nine client-safe block renderers a theme provides (async ones excluded). */
interface ClientBlockSet {
  hero: ComponentType<any>
  promo: ComponentType<any>
  deal: ComponentType<any>
  brand: ComponentType<any>
  rich: ComponentType<any>
  image: ComponentType<any>
  news: ComponentType<any>
  insta: ComponentType<any>
  testi: ComponentType<any>
}

/* Assemble a full canvas block map: the theme's nine client blocks + the shared
   neutral Container + the two Canvas* previews for the async server blocks. The
   two Canvas* previews are bound to the theme id so each theme renders its OWN
   product_tabs / category_showcase View (they resolve the theme-specific View
   from the client-safe registry; unknown/learts ids fall back to the Learts
   previews). Called once per theme at module load, so the bound wrappers have a
   stable identity. */
const blocksFor = (
  themeId: string,
  b: ClientBlockSet
): Record<string, ComponentType<any>> => ({
  hero_slider: b.hero,
  promo_banner_grid: b.promo,
  deal_of_day: b.deal,
  brand_strip: b.brand,
  rich_text: b.rich,
  image_with_text: b.image,
  newsletter: b.news,
  instagram_grid: b.insta,
  testimonials: b.testi,
  container: Container,
  image_gallery: ImageGallery,
  product_tabs: (props: any) => (
    <CanvasProductTabs {...props} themeId={themeId} />
  ),
  category_showcase: (props: any) => (
    <CanvasCategoryShowcase {...props} themeId={themeId} />
  ),
})

export const CANVAS_THEMES: Record<string, CanvasTheme> = {
  learts: {
    Header: LeartsHeader,
    Footer: CanvasFooter,
    bodyClassName: "learts-theme",
    blocks: blocksFor("learts", {
      hero: HeroSlider,
      promo: PromoBannerGrid,
      deal: DealOfDay,
      brand: BrandStrip,
      rich: RichText,
      image: ImageWithText,
      news: Newsletter,
      insta: InstagramGrid,
      testi: Testimonials,
    }),
  },
  aurora: {
    Header: AuroraHeader,
    Footer: AuroraFooterView,
    bodyClassName: "aurora-theme",
    blocks: blocksFor("aurora", {
      hero: AuroraHeroSlider,
      promo: AuroraPromoBannerGrid,
      deal: AuroraDealOfDay,
      brand: AuroraBrandStrip,
      rich: AuroraRichText,
      image: AuroraImageWithText,
      news: AuroraNewsletter,
      insta: AuroraInstagramGrid,
      testi: AuroraTestimonials,
    }),
  },
  cignet: {
    Header: CignetHeader,
    Footer: CignetFooterView,
    bodyClassName: "cignet-theme",
    blocks: blocksFor("cignet", {
      hero: CignetHeroSlider,
      promo: CignetPromoBannerGrid,
      deal: CignetDealOfDay,
      brand: CignetBrandStrip,
      rich: CignetRichText,
      image: CignetImageWithText,
      news: CignetNewsletter,
      insta: CignetInstagramGrid,
      testi: CignetTestimonials,
    }),
  },
  shofy: {
    Header: ShofyHeader,
    Footer: ShofyFooterView,
    bodyClassName: "shofy-theme",
    blocks: blocksFor("shofy", {
      hero: ShofyHeroSlider,
      promo: ShofyPromoBannerGrid,
      deal: ShofyDealOfDay,
      brand: ShofyBrandStrip,
      rich: ShofyRichText,
      image: ShofyImageWithText,
      news: ShofyNewsletter,
      insta: ShofyInstagramGrid,
      testi: ShofyTestimonials,
    }),
  },
  ekka: {
    Header: EkkaHeader,
    Footer: EkkaFooterView,
    bodyClassName: "ekka-theme body-bg-4",
    blocks: blocksFor("ekka", {
      hero: EkkaHeroSlider,
      promo: EkkaPromoBannerGrid,
      deal: EkkaDealOfDay,
      brand: EkkaBrandStrip,
      rich: EkkaRichText,
      image: EkkaImageWithText,
      news: EkkaNewsletter,
      insta: EkkaInstagramGrid,
      testi: EkkaTestimonials,
    }),
  },
  helendo: {
    Header: HelendoHeader,
    Footer: HelendoFooterView,
    bodyClassName: "helendo-theme",
    blocks: blocksFor("helendo", {
      hero: HelendoHeroSlider,
      promo: HelendoPromoBannerGrid,
      deal: HelendoDealOfDay,
      brand: HelendoBrandStrip,
      rich: HelendoRichText,
      image: HelendoImageWithText,
      news: HelendoNewsletter,
      insta: HelendoInstagramGrid,
      testi: HelendoTestimonials,
    }),
  },
  bazaro: {
    Header: BazaroHeader,
    Footer: BazaroFooterView,
    bodyClassName: "bazaro-theme",
    blocks: blocksFor("bazaro", {
      hero: BazaroHeroSlider,
      promo: BazaroPromoBannerGrid,
      deal: BazaroDealOfDay,
      brand: BazaroBrandStrip,
      rich: BazaroRichText,
      image: BazaroImageWithText,
      news: BazaroNewsletter,
      insta: BazaroInstagramGrid,
      testi: BazaroTestimonials,
    }),
  },
  exzo: {
    Header: ExzoHeader,
    Footer: ExzoFooterView,
    bodyClassName: "exzo-theme",
    blocks: blocksFor("exzo", {
      hero: ExzoHeroSlider,
      promo: ExzoPromoBannerGrid,
      deal: ExzoDealOfDay,
      brand: ExzoBrandStrip,
      rich: ExzoRichText,
      image: ExzoImageWithText,
      news: ExzoNewsletter,
      insta: ExzoInstagramGrid,
      testi: ExzoTestimonials,
    }),
  },
  rokon: {
    Header: RokonHeader,
    Footer: RokonFooterView,
    bodyClassName: "rokon-theme",
    blocks: blocksFor("rokon", {
      hero: RokonHeroSlider,
      promo: RokonPromoBannerGrid,
      deal: RokonDealOfDay,
      brand: RokonBrandStrip,
      rich: RokonRichText,
      image: RokonImageWithText,
      news: RokonNewsletter,
      insta: RokonInstagramGrid,
      testi: RokonTestimonials,
    }),
  },
}

/** The canvas theme used for unknown / unset ids (mirrors getThemeById). */
export const DEFAULT_CANVAS_THEME = CANVAS_THEMES.learts

/** Resolve a canvas theme by id, falling back to Learts for unknown ids. */
export function getCanvasTheme(id?: string | null): CanvasTheme {
  return (id && CANVAS_THEMES[id]) || DEFAULT_CANVAS_THEME
}
